import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { invokeLLM } from "./_core/llm";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { storagePut, storageGetSignedUrl } from "./storage";
import {
  createDocument,
  createQuestions,
  createSession,
  createTopic,
  deleteDocument,
  deleteTopic,
  deleteQuestion,
  ensureTopic,
  getDocumentById,
  getDocuments,
  getOverviewStats,
  getProgressByUser,
  getQuestions,
  getRandomQuestions,
  getTopics,
  recordAnswer,
  updateDocumentProcessed,
  updateSession,
  updateUserGithub,
  upsertProgress,
  countQuestions,
  getQuestionById,
  updateDocumentGithubPath,
  createExamSession,
  getExamSession,
  listExamSessions,
  finishExamSession,
  recordExamAnswer,
  getExamAnswers,
  getOverviewStatsByRange,
  getProgressByUserAndRange,
  getDailyAccuracy,
  archivePreviousConvocatoria,
  setQuestionReviewFlag,
  setTopicHidden,
  clearAppData,
  resetAllData,
} from "./db";

// ── Documents router ───────────────────────────────────────────────

const documentsRouter = router({
  list: protectedProcedure
    .input(z.object({ limit: z.number().optional() }).optional())
    .query(({ ctx, input }) => getDocuments(ctx.user.id, input?.limit)),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ ctx, input }) => deleteDocument(input.id, ctx.user.id)),

  markProcessed: protectedProcedure
    .input(z.object({ id: z.number(), error: z.string().optional() }))
    .mutation(({ ctx, input }) =>
      updateDocumentProcessed(input.id, !input.error, input.error)
    ),

  getUploadUrl: protectedProcedure
    .input(
      z.object({
        name: z.string(),
        type: z.enum(["convocatoria", "examen", "tema", "otro"]),
        year: z.string().optional(),
        topicId: z.number().optional(),
        fileSize: z.number().optional(),
      }).refine((data) => data.type !== "tema" || data.topicId !== undefined, {
        message: "Los documentos de tipo tema requieren un bloque temático",
        path: ["topicId"],
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Create a placeholder record — actual upload happens client-side via presigned URL
      // We return a storage key for the client to upload to
      const key = `users/${ctx.user.id}/docs/${Date.now()}-${input.name.replace(/\s+/g, "_")}`;
      const doc = await createDocument({
        userId: ctx.user.id,
        name: input.name,
        type: input.type,
        storageKey: key,
        storageUrl: `/manus-storage/${key}`,
        fileSize: input.fileSize,
        year: input.year,
        topicId: input.topicId ?? null,
        processed: false,
        githubPath: null,
      });
      return { key, docId: (doc as { insertId: number }).insertId };
    }),

  confirmUpload: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const doc = await getDocumentById(input.id, ctx.user.id);
      if (!doc) throw new TRPCError({ code: "NOT_FOUND" });
      // If this is a convocatoria, archive any previous one
      if (doc.type === "convocatoria") {
        await archivePreviousConvocatoria(ctx.user.id, doc.id);
      }
      return { success: true, doc };
    }),

  extractQuestions: protectedProcedure
    .input(z.object({ documentId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const doc = await getDocumentById(input.documentId, ctx.user.id);
      if (!doc) throw new TRPCError({ code: "NOT_FOUND" });

      try {
        // Validate that the document has a valid storage key
        if (!doc.storageKey || doc.storageKey.trim() === "") {
          throw new Error("El documento no tiene archivo asociado. Por favor, elimine el documento y vúelvalo a subir.");
        }

        console.log("[extractQuestions] doc.id:", doc.id, "doc.type:", doc.type, "storageKey:", doc.storageKey);

        // Detect if the document is a Word file (.docx)
        const isDocx = doc.storageKey.toLowerCase().endsWith(".docx") || doc.name.toLowerCase().endsWith(".docx");

        // Build fileContent for the LLM
        // For .docx: convert to plain text with mammoth, then send as text message
        // For .pdf: send as file_url
        let fileContent: Array<{ type: "file_url"; file_url: { url: string; mime_type: "application/pdf" } } | { type: "text"; text: string }>;

        if (isDocx) {
          // Fetch the docx bytes from storage and convert to plain text
          const { default: mammoth } = await import("mammoth");
          const signedUrl = await storageGetSignedUrl(doc.storageKey);
          const fetchRes = await fetch(signedUrl);
          const arrayBuffer = await fetchRes.arrayBuffer();
          const { value: docxText } = await mammoth.extractRawText({ buffer: Buffer.from(arrayBuffer) });
          fileContent = [{ type: "text", text: docxText }];
        } else {
          // Get a proper signed URL so the LLM can access the PDF
          const signedUrl = await storageGetSignedUrl(doc.storageKey);
          fileContent = [
            {
              type: "file_url",
              file_url: { url: signedUrl, mime_type: "application/pdf" },
            },
          ];
        }

        // ── Step 1: If this is a convocatoria, extract the list of topics first ──
        if (doc.type === "convocatoria") {
          console.log("[extractQuestions] Processing convocatoria, isDocx:", isDocx);
          
          let topicsResponse: any;
          try {
            topicsResponse = await invokeLLM({
              messages: [
                {
                  role: "system",
                  content: `Eres un experto en oposiciones de Arquitecto Técnico en España.
Analiza esta convocatoria oficial y extrae la lista completa de temas del temario.
Devuelve ÚnicAMENTE un JSON válido con este esquema:
{
  "topics": [
    { "name": "nombre del tema", "description": "descripción breve del contenido" }
  ]
}
Extrae TODOS los temas que aparezcan en el programa o temario oficial. Normaliza los nombres (sin números de tema, solo el nombre del bloque).`,
                },
                { role: "user", content: fileContent },
              ],
              response_format: {
                type: "json_schema",
                json_schema: {
                  name: "topics_list",
                  strict: true,
                  schema: {
                    type: "object",
                    properties: {
                      topics: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            name: { type: "string" },
                            description: { type: "string" },
                          },
                          required: ["name", "description"],
                          additionalProperties: false,
                        },
                      },
                    },
                    required: ["topics"],
                    additionalProperties: false,
                  },
                },
              },
            });
          } catch (llmErr) {
            console.error("[extractQuestions] LLM call failed:", llmErr);
            throw new Error(`Error al llamar a la IA: ${llmErr instanceof Error ? llmErr.message : String(llmErr)}`);
          }

          console.log("[extractQuestions] LLM response keys:", Object.keys(topicsResponse || {}));
          
          // Handle both possible response shapes
          const rawContent = topicsResponse?.choices?.[0]?.message?.content 
            ?? topicsResponse?.content 
            ?? topicsResponse?.message?.content
            ?? topicsResponse?.text;
          
          console.log("[extractQuestions] Raw content type:", typeof rawContent, "value snippet:", String(rawContent).substring(0, 200));

          if (rawContent) {
            try {
              const contentStr = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);
              const parsedTopics = JSON.parse(contentStr) as { topics: Array<{ name: string; description: string }> };
              console.log("[extractQuestions] Topics parsed:", parsedTopics.topics?.length);
              
              if (Array.isArray(parsedTopics.topics)) {
                for (const t of parsedTopics.topics) {
                  if (t.name) await ensureTopic(ctx.user.id, t.name, t.description);
                }
              }
            } catch (parseErr) {
              console.error("[extractQuestions] JSON parse error:", parseErr, "raw:", String(rawContent).substring(0, 500));
              throw new Error(`Error al parsear respuesta de la IA: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`);
            }
          } else {
            console.error("[extractQuestions] Empty LLM response. Full response:", JSON.stringify(topicsResponse).substring(0, 500));
            throw new Error("La IA no devolvio contenido. Verifica que el PDF es accesible y contiene texto.");
          }
        }

        // ── Step 2: Extract questions (for examen and tema documents) ──
        if (doc.type === "convocatoria") {
          // For convocatoria we only extract topics, not questions
          await updateDocumentProcessed(input.documentId, true);
          const topicCount = (await getTopics(ctx.user.id)).length;
          return { count: 0, topicsCreated: topicCount };
        }

        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `Eres un experto en oposiciones de Arquitecto Técnico en España. 
Tu tarea es extraer preguntas tipo test de un documento oficial.
Devuelve ÚNICAMENTE un JSON válido con el siguiente esquema exacto:
{
  "questions": [
    {
      "question": "texto de la pregunta",
      "optionA": "opción A",
      "optionB": "opción B", 
      "optionC": "opción C",
      "optionD": "opción D",
      "correctOption": "A",
      "explanation": "explicación breve de por qué es correcta",
      "topic": "nombre del bloque temático (ej: Estructuras, Instalaciones, Normativa, Materiales, Gestión de obras, etc.)",
      "difficulty": "facil"
    }
  ]
}
Extrae TODAS las preguntas que encuentres. Si no hay respuesta correcta indicada, infiere la más probable.`,
            },
            { role: "user", content: fileContent },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "extracted_questions",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  questions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        question: { type: "string" },
                        optionA: { type: "string" },
                        optionB: { type: "string" },
                        optionC: { type: "string" },
                        optionD: { type: "string" },
                        correctOption: { type: "string", enum: ["A", "B", "C", "D"] },
                        explanation: { type: "string" },
                        topic: { type: "string" },
                        difficulty: { type: "string", enum: ["facil", "medio", "dificil"] },
                      },
                      required: ["question", "optionA", "optionB", "optionC", "optionD", "correctOption", "explanation", "topic", "difficulty"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["questions"],
                additionalProperties: false,
              },
            },
          },
        });

        const content = response.choices[0]?.message?.content;
        if (!content) throw new Error("Empty LLM response");

        const parsed = JSON.parse(typeof content === "string" ? content : JSON.stringify(content)) as {
          questions: Array<{
            question: string;
            optionA: string;
            optionB: string;
            optionC: string;
            optionD: string;
            correctOption: "A" | "B" | "C" | "D";
            explanation: string;
            topic: string;
            difficulty: "facil" | "medio" | "dificil";
          }>;
        };

        const toInsert = await Promise.all(
          parsed.questions.map(async (q) => {
            // For 'tema' documents, use the topic already assigned to the document
            // to avoid creating duplicate topics via AI inference
            const topicId = (doc.type === "tema" && doc.topicId)
              ? doc.topicId
              : await ensureTopic(ctx.user.id, q.topic);
            return {
              userId: ctx.user.id,
              documentId: input.documentId,
              topicId,
              source: "extracted" as const,
              question: q.question,
              optionA: q.optionA,
              optionB: q.optionB,
              optionC: q.optionC,
              optionD: q.optionD,
              correctOption: q.correctOption,
              explanation: q.explanation,
              difficulty: q.difficulty,
              tags: [],
            };
          })
        );

        await createQuestions(toInsert);
        await updateDocumentProcessed(input.documentId, true);

        return { count: toInsert.length };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        await updateDocumentProcessed(input.documentId, false, msg);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: msg });
      }
    }),
});

// ── Topics router ──────────────────────────────────────────────────

const topicsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const rawTopics = await getTopics(ctx.user.id);
    const progress = await getProgressByUser(ctx.user.id);
    const allDocs = await getDocuments(ctx.user.id);
    // Build a map: topicId -> list of tema documents
    const docsByTopic = new Map<number, typeof allDocs>();
    for (const doc of allDocs) {
      if (doc.type === "tema" && doc.topicId) {
        if (!docsByTopic.has(doc.topicId)) docsByTopic.set(doc.topicId, []);
        docsByTopic.get(doc.topicId)!.push(doc);
      }
    }
    // Detectar colisión de topicNumber entre grupos distintos
    const numCount = new Map<number, number>();
    for (const t of rawTopics) {
      if (t.topicNumber != null) {
        numCount.set(t.topicNumber, (numCount.get(t.topicNumber) ?? 0) + 1);
      }
    }

    return rawTopics.map((t) => {
      const p = progress.find((p) => p.topicId === t.id);
      const docs = docsByTopic.get(t.id) ?? [];
      // Construir etiqueta de visualización
      let displayLabel = t.name;
      if (t.topicNumber != null) {
        const hasCollision = (numCount.get(t.topicNumber) ?? 0) > 1;
        const prefix = t.group
          ? (hasCollision ? `${t.group} · Tema ${t.topicNumber}` : `Tema ${t.topicNumber}`)
          : `Tema ${t.topicNumber}`;
        displayLabel = `${prefix} — ${t.name}`;
      } else if (t.group) {
        displayLabel = `${t.group} — ${t.name}`;
      }
      return {
        ...t,
        displayLabel,
        totalAnswered: p?.totalAnswered ?? 0,
        totalCorrect: p?.totalCorrect ?? 0,
        totalWrong: p?.totalWrong ?? 0,
        hasDocument: docs.length > 0,
        documents: docs.map((d) => ({ id: d.id, name: d.name, processed: d.processed })),
      };
    });
  }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      group: z.string().optional(),
      topicNumber: z.number().int().positive().optional(),
    }))
    .mutation(({ ctx, input }) =>
      createTopic({
        userId: ctx.user.id,
        name: input.name,
        description: input.description,
        group: input.group ?? null,
        topicNumber: input.topicNumber ?? null,
      })
    ),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ ctx, input }) => deleteTopic(input.id, ctx.user.id)),

  toggleHidden: protectedProcedure
    .input(z.object({ id: z.number(), hidden: z.boolean() }))
    .mutation(({ ctx, input }) => setTopicHidden(input.id, ctx.user.id, input.hidden)),
});

// ── Questions router ───────────────────────────────────────────────

const questionsRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        topicId: z.number().optional(),
        topicIds: z.array(z.number()).optional(),
        source: z.string().optional(),
        docType: z.string().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
        reviewOnly: z.boolean().optional(),
      }).optional()
    )
    .query(({ ctx, input }) =>
      getQuestions(ctx.user.id, {
        topicId: input?.topicId,
        topicIds: input?.topicIds,
        source: input?.source,
        docType: input?.docType,
        limit: input?.limit ?? 50,
        offset: input?.offset ?? 0,
        reviewOnly: input?.reviewOnly,
      })
    ),

  count: protectedProcedure.query(({ ctx }) => countQuestions(ctx.user.id)),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ ctx, input }) => deleteQuestion(input.id, ctx.user.id)),

  setReviewFlag: protectedProcedure
    .input(z.object({ id: z.number(), flag: z.boolean() }))
    .mutation(({ ctx, input }) => setQuestionReviewFlag(input.id, ctx.user.id, input.flag)),

  topicsWithCounts: protectedProcedure.query(async ({ ctx }) => {
    const rawTopics = await getTopics(ctx.user.id);
    const progress = await getProgressByUser(ctx.user.id);
    // Detectar colisión de topicNumber
    const numCount = new Map<number, number>();
    for (const t of rawTopics) {
      if (t.topicNumber != null) numCount.set(t.topicNumber, (numCount.get(t.topicNumber) ?? 0) + 1);
    }
    return rawTopics.map((t) => {
      const p = progress.find((p) => p.topicId === t.id);
      let displayLabel = t.name;
      if (t.topicNumber != null) {
        const hasCollision = (numCount.get(t.topicNumber) ?? 0) > 1;
        const prefix = t.group
          ? (hasCollision ? `${t.group} · Tema ${t.topicNumber}` : `Tema ${t.topicNumber}`)
          : `Tema ${t.topicNumber}`;
        displayLabel = `${prefix} — ${t.name}`;
      } else if (t.group) {
        displayLabel = `${t.group} — ${t.name}`;
      }
      return {
        id: t.id,
        name: t.name,
        group: t.group,
        topicNumber: t.topicNumber,
        displayLabel,
        totalAnswered: p?.totalAnswered ?? 0,
        totalCorrect: p?.totalCorrect ?? 0,
      };
    });
  }),

  generate: protectedProcedure
    .input(
      z.object({
        topicId: z.number().optional(),   // si se pasa, se usa directamente sin crear duplicado
        topicName: z.string(),             // nombre para el prompt de la IA y para crear topic nuevo si no hay topicId
        count: z.number().min(1).max(20).default(5),
        difficulty: z.enum(["facil", "medio", "dificil"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      console.log(`[generate] user=${ctx.user.id} topicId=${input.topicId} topicName="${input.topicName}" count=${input.count} difficulty=${input.difficulty}`);
      
      // Validar que hay nombre de tema (puede ser vacío si el topic no cargó en el cliente)
      const topicName = input.topicName.trim();
      if (!topicName) {
        throw new TRPCError({ 
          code: "BAD_REQUEST", 
          message: "El bloque temático no puede estar vacío. Selecciona un tema del listado o escribe un nombre."
        });
      }

      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `Eres un experto en oposiciones de Arquitecto Técnico en España. 
Genera preguntas tipo test originales y rigurosas sobre el tema indicado, basándote en:
- Normativa española vigente (CTE, LOE, LOPD, etc.)
- Conocimiento técnico de construcción y edificación
- Contenidos habituales en oposiciones de Arquitecto Técnico
Devuelve ÚNICAMENTE JSON válido.`,
          },
          {
            role: "user",
            content: `Genera ${input.count} preguntas tipo test sobre: "${topicName}".
${input.difficulty ? `Dificultad: ${input.difficulty}` : "Mezcla dificultades."}
Formato JSON:
{
  "questions": [
    {
      "question": "...",
      "optionA": "...",
      "optionB": "...",
      "optionC": "...",
      "optionD": "...",
      "correctOption": "A"|"B"|"C"|"D",
      "explanation": "explicación detallada de la respuesta correcta",
      "difficulty": "facil"|"medio"|"dificil"
    }
  ]
}`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "generated_questions",
            strict: true,
            schema: {
              type: "object",
              properties: {
                questions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      question: { type: "string" },
                      optionA: { type: "string" },
                      optionB: { type: "string" },
                      optionC: { type: "string" },
                      optionD: { type: "string" },
                      correctOption: { type: "string", enum: ["A", "B", "C", "D"] },
                      explanation: { type: "string" },
                      difficulty: { type: "string", enum: ["facil", "medio", "dificil"] },
                    },
                    required: ["question", "optionA", "optionB", "optionC", "optionD", "correctOption", "explanation", "difficulty"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["questions"],
              additionalProperties: false,
            },
          },
        },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const parsed = JSON.parse(typeof content === "string" ? content : JSON.stringify(content)) as {
        questions: Array<{
          question: string;
          optionA: string;
          optionB: string;
          optionC: string;
          optionD: string;
          correctOption: "A" | "B" | "C" | "D";
          explanation: string;
          difficulty: "facil" | "medio" | "dificil";
        }>;
      };

      // Si se pasa topicId explícito, lo usamos directamente (evita duplicados por nombre)
      const topicId = input.topicId ?? await ensureTopic(ctx.user.id, topicName);
      const toInsert = parsed.questions.map((q) => ({
        userId: ctx.user.id,
        documentId: null,
        topicId,
        source: "ai_generated" as const,
        question: q.question,
        optionA: q.optionA,
        optionB: q.optionB,
        optionC: q.optionC,
        optionD: q.optionD,
        correctOption: q.correctOption,
        explanation: q.explanation,
        difficulty: q.difficulty,
        tags: [],
      }));

      await createQuestions(toInsert);
      return { count: toInsert.length, topicId };
    }),
});

// ── Practice router ────────────────────────────────────────────────

const practiceRouter = router({
  startSession: protectedProcedure
    .input(
      z.object({
        topicId: z.number().optional(),
        topicIds: z.array(z.number()).optional(),
        source: z.string().optional(),
        count: z.number().min(1).max(50).default(10),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const hasMultiTopics = input.topicIds && input.topicIds.length > 0;

      let qs: Awaited<ReturnType<typeof getRandomQuestions>> = [];

      if (hasMultiTopics) {
        qs = await getRandomQuestions(ctx.user.id, input.count, {
          topicIds: input.topicIds,
          source: input.source,
        });
      } else {
        qs = await getRandomQuestions(ctx.user.id, input.count, {
          topicId: input.topicId,
          source: input.source,
        });
      }

      if (qs.length === 0)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No hay preguntas disponibles con los filtros seleccionados",
        });

      const sessionId = await createSession({
        userId: ctx.user.id,
        filterTopicId: input.topicId ?? (hasMultiTopics ? input.topicIds![0] : undefined),
        filterSource: input.source,
        totalQuestions: qs.length,
      });

      return { sessionId, questions: qs };
    }),

  submitAnswer: protectedProcedure
    .input(
      z.object({
        sessionId: z.number(),
        questionId: z.number(),
        selectedOption: z.enum(["A", "B", "C", "D"]),
        topicId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get the specific question by ID directly
      const question = await getQuestionById(input.questionId, ctx.user.id);

      if (!question) throw new TRPCError({ code: "NOT_FOUND" });

      const isCorrect = question.correctOption === input.selectedOption;

      await recordAnswer({
        sessionId: input.sessionId,
        questionId: input.questionId,
        userId: ctx.user.id,
        selectedOption: input.selectedOption,
        isCorrect,
      });

      if (input.topicId) {
        await upsertProgress(ctx.user.id, input.topicId, isCorrect);
      } else if (question.topicId) {
        await upsertProgress(ctx.user.id, question.topicId, isCorrect);
      }

      return {
        isCorrect,
        correctOption: question.correctOption,
        explanation: question.explanation,
      };
    }),

  finishSession: protectedProcedure
    .input(
      z.object({
        sessionId: z.number(),
        correct: z.number(),
        wrong: z.number(),
        total: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await updateSession(input.sessionId, {
        finishedAt: new Date(),
        correctAnswers: input.correct,
        wrongAnswers: input.wrong,
        totalQuestions: input.total,
      });
      return { success: true };
    }),
});

// ── Stats router ───────────────────────────────────────────────────

const statsRouter = router({
  overview: protectedProcedure
    .input(z.object({
      from: z.string().optional(), // ISO date string
      to: z.string().optional(),
    }).optional())
    .query(({ ctx, input }) => {
      const from = input?.from ? new Date(input.from) : undefined;
      const to = input?.to ? new Date(input.to) : undefined;
      return getOverviewStatsByRange(ctx.user.id, from, to);
    }),
  progress: protectedProcedure
    .input(z.object({
      from: z.string().optional(),
      to: z.string().optional(),
    }).optional())
    .query(({ ctx, input }) => {
      const from = input?.from ? new Date(input.from) : undefined;
      const to = input?.to ? new Date(input.to) : undefined;
      return getProgressByUserAndRange(ctx.user.id, from, to);
    }),
  evolution: protectedProcedure
    .input(z.object({
      days: z.number().min(7).max(365).default(30),
    }).optional())
    .query(async ({ ctx, input }) => {
      return getDailyAccuracy(ctx.user.id, input?.days ?? 30);
    }),
});

// ── Exam router ────────────────────────────────────────────────────

const examRouter = router({
  start: protectedProcedure
    .input(z.object({
      title: z.string().default("Examen"),
      topicIds: z.array(z.number()).default([]),
      source: z.string().default("all"),
      count: z.number().min(5).max(100).default(20),
      penaltyPerError: z.string().default("0.25"),
    }))
    .mutation(async ({ ctx, input }) => {
      const opts: { topicId?: number; source?: string } = {};
      if (input.source !== "all") opts.source = input.source;

      let questions: Awaited<ReturnType<typeof getRandomQuestions>> = [];

      if (input.topicIds.length > 0) {
        // Fetch from each topic and merge
        for (const topicId of input.topicIds) {
          const perTopic = Math.ceil(input.count / input.topicIds.length);
          const qs = await getRandomQuestions(ctx.user.id, perTopic, { ...opts, topicId });
          questions = [...questions, ...qs];
        }
        // Shuffle and trim to exact count
        questions = questions.sort(() => Math.random() - 0.5).slice(0, input.count);
      } else {
        questions = await getRandomQuestions(ctx.user.id, input.count, opts);
      }

      if (questions.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No hay preguntas disponibles con los filtros seleccionados. Genera o extrae preguntas primero.",
        });
      }

      const examId = await createExamSession({
        userId: ctx.user.id,
        title: input.title,
        topicIds: input.topicIds,
        source: input.source,
        totalQuestions: questions.length,
        penaltyPerError: input.penaltyPerError,
      });

      return { examId, questions };
    }),

  submitAnswer: protectedProcedure
    .input(z.object({
      examSessionId: z.number(),
      questionId: z.number(),
      selectedOption: z.enum(["A", "B", "C", "D", "blank"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const question = await getQuestionById(input.questionId, ctx.user.id);
      if (!question) throw new TRPCError({ code: "NOT_FOUND" });

      const isCorrect = input.selectedOption !== "blank" && question.correctOption === input.selectedOption;

      await recordExamAnswer({
        examSessionId: input.examSessionId,
        questionId: input.questionId,
        userId: ctx.user.id,
        selectedOption: input.selectedOption,
        isCorrect,
      });

      return { success: true };
    }),

  finish: protectedProcedure
    .input(z.object({ examSessionId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const session = await getExamSession(input.examSessionId, ctx.user.id);
      if (!session) throw new TRPCError({ code: "NOT_FOUND" });

      const answers = await getExamAnswers(input.examSessionId, ctx.user.id);

      const correct = answers.filter((a) => a.isCorrect).length;
      const blank = answers.filter((a) => a.selectedOption === "blank").length;
      const wrong = answers.filter((a) => !a.isCorrect && a.selectedOption !== "blank").length;

      const penalty = parseFloat(session.penaltyPerError ?? "0.25");
      const rawScore = correct;
      const finalScore = Math.max(0, correct - wrong * penalty);

      await finishExamSession(input.examSessionId, ctx.user.id, {
        correctAnswers: correct,
        wrongAnswers: wrong,
        blankAnswers: blank,
        rawScore: rawScore.toFixed(2),
        finalScore: finalScore.toFixed(2),
        finishedAt: new Date(),
      });

      return { success: true };
    }),

  getResult: protectedProcedure
    .input(z.object({ examSessionId: z.number() }))
    .query(async ({ ctx, input }) => {
      const session = await getExamSession(input.examSessionId, ctx.user.id);
      if (!session) throw new TRPCError({ code: "NOT_FOUND" });

      const answers = await getExamAnswers(input.examSessionId, ctx.user.id);

      // Group by topic for per-topic stats
      const byTopic: Record<string, { name: string; correct: number; wrong: number; blank: number; total: number }> = {};
      for (const a of answers) {
        const key = String(a.topicId ?? "sin-tema");
        if (!byTopic[key]) byTopic[key] = { name: a.topicName ?? "Sin tema", correct: 0, wrong: 0, blank: 0, total: 0 };
        byTopic[key].total++;
        if (a.isCorrect) byTopic[key].correct++;
        else if (a.selectedOption === "blank") byTopic[key].blank++;
        else byTopic[key].wrong++;
      }

      const topicStats = Object.entries(byTopic).map(([id, s]) => ({
        topicId: id,
        ...s,
        pct: s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0,
      }));

      topicStats.sort((a, b) => a.pct - b.pct);

      return {
        session,
        answers,
        topicStats,
        bestTopic: topicStats.length > 0 ? topicStats[topicStats.length - 1] : null,
        worstTopic: topicStats.length > 0 ? topicStats[0] : null,
      };
    }),

  list: protectedProcedure.query(({ ctx }) => listExamSessions(ctx.user.id)),
});

// ── GitHub router ──────────────────────────────────────────────────

const githubRouter = router({
  getConfig: protectedProcedure.query(async ({ ctx }) => {
    return {
      githubRepo: ctx.user.githubRepo ?? "Songorka/Estudia_opo_arq_tec",
      githubBranch: ctx.user.githubBranch ?? "main",
      lastGithubSync: ctx.user.lastGithubSync,
      hasToken: !!(ctx.user.githubToken), // never expose the token itself
    };
  }),

  saveConfig: protectedProcedure
    .input(
      z.object({
        githubRepo: z.string(),
        githubToken: z.string().optional(),
        githubBranch: z.string().default("main"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await updateUserGithub(ctx.user.id, {
        githubRepo: input.githubRepo,
        githubToken: input.githubToken,
        githubBranch: input.githubBranch,
      });
      return { success: true };
    }),

  syncFromGithub: protectedProcedure.mutation(async ({ ctx }) => {
    const repo = ctx.user.githubRepo ?? "Songorka/Estudia_opo_arq_tec";
    const branch = ctx.user.githubBranch ?? "main";
    const token = ctx.user.githubToken;

    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "oposiciones-app",
    };
    if (token) headers["Authorization"] = `token ${token}`;

    // Fetch tree from GitHub
    const treeRes = await fetch(
      `https://api.github.com/repos/${repo}/git/trees/${branch}?recursive=1`,
      { headers }
    );
    if (!treeRes.ok) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `GitHub API error: ${treeRes.status}`,
      });
    }
    const tree = (await treeRes.json()) as {
      tree: Array<{ path: string; type: string; sha: string; url: string }>;
    };

    const pdfFiles = tree.tree.filter(
      (f) => f.type === "blob" && f.path.endsWith(".pdf")
    );

    // Get existing docs to avoid duplicates
    const existingDocs = await getDocuments(ctx.user.id);
    const existingPaths = new Set(existingDocs.map((d) => d.githubPath));

    let added = 0;
    for (const file of pdfFiles) {
      if (existingPaths.has(file.path)) continue;

      const name = file.path.split("/").pop() ?? file.path;
      const folder = file.path.split("/")[0] ?? "otro";
      const type =
        folder === "convocatoria"
          ? "convocatoria"
          : folder === "examenes"
          ? "examen"
          : folder === "temas"
          ? "tema"
          : "otro";

      // Download file content
      const blobRes = await fetch(
        `https://api.github.com/repos/${repo}/contents/${file.path}?ref=${branch}`,
        { headers }
      );
      if (!blobRes.ok) continue;
      const blobData = (await blobRes.json()) as { download_url: string };

      const fileRes = await fetch(blobData.download_url);
      if (!fileRes.ok) continue;
      const buffer = Buffer.from(await fileRes.arrayBuffer());

      const key = `users/${ctx.user.id}/github/${file.sha}-${name.replace(/\s+/g, "_")}`;
      await storagePut(key, buffer, "application/pdf");

      await createDocument({
        userId: ctx.user.id,
        name,
        type: type as "convocatoria" | "examen" | "tema" | "otro",
        storageKey: key,
        storageUrl: `/manus-storage/${key}`,
        fileSize: buffer.length,
        githubPath: file.path,
        processed: false,
      });
      added++;
    }

    await updateUserGithub(ctx.user.id, { lastGithubSync: new Date() });
    return { added, total: pdfFiles.length };
  }),

  pushToGithub: protectedProcedure
    .input(z.object({ documentId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const doc = await getDocumentById(input.documentId, ctx.user.id);
      if (!doc) throw new TRPCError({ code: "NOT_FOUND" });

      const repo = ctx.user.githubRepo ?? "Songorka/Estudia_opo_arq_tec";
      const branch = ctx.user.githubBranch ?? "main";
      const token = ctx.user.githubToken;

      if (!token) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Se necesita un token de GitHub para hacer push",
        });
      }

      // Fetch file from storage
      const storageUrl = `${process.env.BUILT_IN_FORGE_API_URL?.replace(/\/+$/, "")}/v1/storage/presign/get?path=${encodeURIComponent(doc.storageKey)}`;
      const presignRes = await fetch(storageUrl, {
        headers: { Authorization: `Bearer ${process.env.BUILT_IN_FORGE_API_KEY}` },
      });
      if (!presignRes.ok) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "No se pudo obtener el archivo" });
      const { url: signedUrl } = (await presignRes.json()) as { url: string };

      const fileRes = await fetch(signedUrl);
      if (!fileRes.ok) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "No se pudo descargar el archivo" });
      const buffer = Buffer.from(await fileRes.arrayBuffer());
      const base64 = buffer.toString("base64");

      const folder =
        doc.type === "convocatoria"
          ? "convocatoria"
          : doc.type === "examen"
          ? "examenes"
          : doc.type === "tema"
          ? "temas"
          : "otros";
      const path = `${folder}/${doc.name}`;

      const headers = {
        Accept: "application/vnd.github.v3+json",
        Authorization: `token ${token}`,
        "User-Agent": "oposiciones-app",
        "Content-Type": "application/json",
      };

      // Check if file exists to get SHA
      let sha: string | undefined;
      const checkRes = await fetch(
        `https://api.github.com/repos/${repo}/contents/${path}?ref=${branch}`,
        { headers }
      );
      if (checkRes.ok) {
        const existing = (await checkRes.json()) as { sha: string };
        sha = existing.sha;
      }

      const body: Record<string, unknown> = {
        message: `docs: add ${doc.name}`,
        content: base64,
        branch,
      };
      if (sha) body.sha = sha;

      const putRes = await fetch(
        `https://api.github.com/repos/${repo}/contents/${path}`,
        { method: "PUT", headers, body: JSON.stringify(body) }
      );

      if (!putRes.ok) {
        const err = await putRes.text();
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `GitHub error: ${err}` });
      }

      // Update the document's githubPath so we don't re-push next time
      await updateDocumentGithubPath(input.documentId, path, ctx.user.id);

      return { success: true, path };
    }),
});

// ── App router ─────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  documents: documentsRouter,
  topics: topicsRouter,
  questions: questionsRouter,
  practice: practiceRouter,
  stats: statsRouter,
  exam: examRouter,
  github: githubRouter,
  app: router({
    clearData: protectedProcedure
      .mutation(({ ctx }) => clearAppData(ctx.user.id)),
    resetAll: protectedProcedure
      .mutation(({ ctx }) => resetAllData(ctx.user.id)),
  }),
});

export type AppRouter = typeof appRouter;
