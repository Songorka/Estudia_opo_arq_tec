import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { invokeLLM } from "./_core/llm";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { storagePut } from "./storage";
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
        fileSize: z.number().optional(),
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
      return { success: true, doc };
    }),

  extractQuestions: protectedProcedure
    .input(z.object({ documentId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const doc = await getDocumentById(input.documentId, ctx.user.id);
      if (!doc) throw new TRPCError({ code: "NOT_FOUND" });

      try {
        const fileContent: Array<{
          type: "file_url";
          file_url: { url: string; mime_type: "application/pdf" };
        }> = [
          {
            type: "file_url",
            file_url: {
              url: `${process.env.BUILT_IN_FORGE_API_URL?.replace(/\/+$/, "")}/v1/storage/presign/get?path=${encodeURIComponent(doc.storageKey)}`,
              mime_type: "application/pdf",
            },
          },
        ];

        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `Eres un experto en oposiciones de Arquitecto Técnico en España. 
Tu tarea es extraer preguntas tipo test de un examen oficial.
Devuelve ÚNICAMENTE un JSON válido con el siguiente esquema exacto:
{
  "questions": [
    {
      "question": "texto de la pregunta",
      "optionA": "opción A",
      "optionB": "opción B", 
      "optionC": "opción C",
      "optionD": "opción D",
      "correctOption": "A" | "B" | "C" | "D",
      "explanation": "explicación breve de por qué es correcta",
      "topic": "nombre del bloque temático (ej: Estructuras, Instalaciones, Normativa, Materiales, Gestión de obras, etc.)",
      "difficulty": "facil" | "medio" | "dificil"
    }
  ]
}
Extrae TODAS las preguntas que encuentres. Si no hay respuesta correcta indicada, infiere la más probable.`,
            },
            {
              role: "user",
              content: fileContent,
            },
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
            const topicId = await ensureTopic(ctx.user.id, q.topic);
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
    return rawTopics.map((t) => {
      const p = progress.find((p) => p.topicId === t.id);
      return {
        ...t,
        totalAnswered: p?.totalAnswered ?? 0,
        totalCorrect: p?.totalCorrect ?? 0,
        totalWrong: p?.totalWrong ?? 0,
      };
    });
  }),

  create: protectedProcedure
    .input(z.object({ name: z.string().min(1), description: z.string().optional() }))
    .mutation(({ ctx, input }) =>
      createTopic({ userId: ctx.user.id, name: input.name, description: input.description })
    ),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ ctx, input }) => deleteTopic(input.id, ctx.user.id)),
});

// ── Questions router ───────────────────────────────────────────────

const questionsRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        topicId: z.number().optional(),
        source: z.string().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }).optional()
    )
    .query(({ ctx, input }) =>
      getQuestions(ctx.user.id, {
        topicId: input?.topicId,
        source: input?.source,
        limit: input?.limit ?? 50,
        offset: input?.offset ?? 0,
      })
    ),

  count: protectedProcedure.query(({ ctx }) => countQuestions(ctx.user.id)),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ ctx, input }) => deleteQuestion(input.id, ctx.user.id)),

  generate: protectedProcedure
    .input(
      z.object({
        topicName: z.string(),
        count: z.number().min(1).max(20).default(5),
        difficulty: z.enum(["facil", "medio", "dificil"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
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
            content: `Genera ${input.count} preguntas tipo test sobre: "${input.topicName}".
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

      const topicId = await ensureTopic(ctx.user.id, input.topicName);
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
        source: z.string().optional(),
        count: z.number().min(1).max(50).default(10),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const qs = await getRandomQuestions(ctx.user.id, input.count, {
        topicId: input.topicId,
        source: input.source,
      });

      if (qs.length === 0)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No hay preguntas disponibles con los filtros seleccionados",
        });

      const sessionId = await createSession({
        userId: ctx.user.id,
        filterTopicId: input.topicId,
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
  overview: protectedProcedure.query(({ ctx }) => getOverviewStats(ctx.user.id)),
  progress: protectedProcedure.query(({ ctx }) => getProgressByUser(ctx.user.id)),
});

// ── GitHub router ──────────────────────────────────────────────────

const githubRouter = router({
  getConfig: protectedProcedure.query(async ({ ctx }) => {
    return {
      githubRepo: ctx.user.githubRepo ?? "Songorka/Estudia_opo_arq_tec",
      githubBranch: ctx.user.githubBranch ?? "main",
      lastGithubSync: ctx.user.lastGithubSync,
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
  github: githubRouter,
});

export type AppRouter = typeof appRouter;
