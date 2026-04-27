import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  documents,
  examAnswers,
  examSessions,
  InsertDocument,
  InsertPracticeSession,
  InsertQuestion,
  InsertSessionAnswer,
  InsertTopic,
  InsertUser,
  practiceSessions,
  questions,
  sessionAnswers,
  topics,
  userProgress,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ── Users ──────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};

  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    const value = user[field];
    if (value === undefined) continue;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  }

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }

  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateUserGithub(
  userId: number,
  data: { githubRepo?: string; githubToken?: string; githubBranch?: string; lastGithubSync?: Date }
) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set(data).where(eq(users.id, userId));
}

// ── Documents ──────────────────────────────────────────────────────

export async function createDocument(doc: InsertDocument) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(documents).values(doc);
  return result;
}

export async function getDocuments(userId: number, limit?: number) {
  const db = await getDb();
  if (!db) return [];
  const q = db
    .select()
    .from(documents)
    .where(eq(documents.userId, userId))
    .orderBy(desc(documents.createdAt));
  if (limit) return q.limit(limit);
  return q;
}

export async function getDocumentById(id: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, id), eq(documents.userId, userId)))
    .limit(1);
  return result[0];
}

export async function updateDocumentProcessed(
  id: number,
  processed: boolean,
  error?: string
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(documents)
    .set({ processed, processingError: error ?? null })
    .where(eq(documents.id, id));
}

export async function deleteDocument(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .delete(documents)
    .where(and(eq(documents.id, id), eq(documents.userId, userId)));
}

// ── Topics ─────────────────────────────────────────────────────────

export async function getTopics(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(topics)
    .where(eq(topics.userId, userId))
    .orderBy(topics.order);
}

export async function createTopic(topic: InsertTopic) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(topics).values(topic);
  return result;
}

export async function ensureTopic(userId: number, name: string, description?: string): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const existing = await db
    .select()
    .from(topics)
    .where(and(eq(topics.userId, userId), eq(topics.name, name)))
    .limit(1);
  if (existing.length > 0) return existing[0].id;
  const [result] = await db.insert(topics).values({ userId, name, ...(description ? { description } : {}) });
  return (result as { insertId: number }).insertId;
}

export async function deleteTopic(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(topics).where(and(eq(topics.id, id), eq(topics.userId, userId)));
}

// ── Questions ──────────────────────────────────────────────────────

export async function createQuestion(q: InsertQuestion) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(questions).values(q);
  return result;
}

export async function createQuestions(qs: InsertQuestion[]) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  if (qs.length === 0) return;
  await db.insert(questions).values(qs);
}

export async function getQuestions(
  userId: number,
  opts?: { topicId?: number; topicIds?: number[]; source?: string; docType?: string; limit?: number; offset?: number; reviewOnly?: boolean }
) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(questions.userId, userId), eq(questions.active, true)];
  if (opts?.topicIds && opts.topicIds.length > 0) {
    conditions.push(inArray(questions.topicId, opts.topicIds));
  } else if (opts?.topicId) {
    conditions.push(eq(questions.topicId, opts.topicId));
  }
  if (opts?.source)
    conditions.push(eq(questions.source, opts.source as "extracted" | "ai_generated"));
  if (opts?.reviewOnly) conditions.push(eq(questions.reviewFlag, true));

  if (opts?.docType) {
    // Join with documents to filter by document type
    const docIds = await db
      .select({ id: documents.id })
      .from(documents)
      .where(and(eq(documents.userId, userId), eq(documents.type, opts.docType as "convocatoria" | "examen" | "tema" | "otro")));
    const ids = docIds.map((d) => d.id);
    if (ids.length === 0) return [];
    conditions.push(inArray(questions.documentId, ids));
  }

  const q = db
    .select()
    .from(questions)
    .where(and(...conditions))
    .orderBy(desc(questions.createdAt));

  if (opts?.limit) return q.limit(opts.limit).offset(opts?.offset ?? 0);
  return q;
}

export async function getRandomQuestions(
  userId: number,
  count: number,
  opts?: { topicId?: number; topicIds?: number[]; source?: string; docType?: string }
) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(questions.userId, userId), eq(questions.active, true)];
  if (opts?.topicIds && opts.topicIds.length > 0) {
    conditions.push(inArray(questions.topicId, opts.topicIds));
  } else if (opts?.topicId) {
    conditions.push(eq(questions.topicId, opts.topicId));
  }
  if (opts?.source)
    conditions.push(eq(questions.source, opts.source as "extracted" | "ai_generated"));

  if (opts?.docType) {
    const docIds = await db
      .select({ id: documents.id })
      .from(documents)
      .where(and(eq(documents.userId, userId), eq(documents.type, opts.docType as "convocatoria" | "examen" | "tema" | "otro")));
    const ids = docIds.map((d) => d.id);
    if (ids.length === 0) return [];
    conditions.push(inArray(questions.documentId, ids));
  }

  return db
    .select()
    .from(questions)
    .where(and(...conditions))
    .orderBy(sql`RAND()`)
    .limit(count);
}

export async function countQuestions(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(questions)
    .where(and(eq(questions.userId, userId), eq(questions.active, true)));
  return Number(result[0]?.count ?? 0);
}

export async function getQuestionById(id: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(questions)
    .where(and(eq(questions.id, id), eq(questions.userId, userId)))
    .limit(1);
  return result[0];
}

// Archiva (elimina) documentos de tipo convocatoria anteriores del mismo usuario
export async function archivePreviousConvocatoria(userId: number, exceptDocId: number) {
  const db = await getDb();
  if (!db) return;
  // Obtener todos los documentos de convocatoria excepto el nuevo
  const prev = await db
    .select({ id: documents.id })
    .from(documents)
    .where(and(eq(documents.userId, userId), eq(documents.type, "convocatoria")))
    .then((rows) => rows.filter((r) => r.id !== exceptDocId));
  if (prev.length === 0) return;
  const ids = prev.map((r) => r.id);
  await db.delete(documents).where(and(eq(documents.userId, userId), inArray(documents.id, ids)));
}

// Obtener documentos de un tipo concreto
export async function getDocumentsByType(userId: number, type: string) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(documents)
    .where(and(eq(documents.userId, userId), eq(documents.type, type as "convocatoria" | "examen" | "tema" | "otro")))
    .orderBy(desc(documents.createdAt));
}

export async function updateDocumentGithubPath(id: number, githubPath: string, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(documents)
    .set({ githubPath })
    .where(and(eq(documents.id, id), eq(documents.userId, userId)));
}

export async function deleteQuestion(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(questions)
    .set({ active: false })
    .where(and(eq(questions.id, id), eq(questions.userId, userId)));
}

export async function setQuestionReviewFlag(id: number, userId: number, flag: boolean) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(questions)
    .set({ reviewFlag: flag })
    .where(and(eq(questions.id, id), eq(questions.userId, userId)));
}

export async function getReviewQuestions(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(questions)
    .where(and(eq(questions.userId, userId), eq(questions.active, true), eq(questions.reviewFlag, true)))
    .orderBy(desc(questions.createdAt));
}

// ── Practice Sessions ──────────────────────────────────────────────

export async function createSession(s: InsertPracticeSession) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(practiceSessions).values(s);
  return (result as { insertId: number }).insertId;
}

export async function updateSession(
  id: number,
  data: Partial<{
    finishedAt: Date;
    totalQuestions: number;
    correctAnswers: number;
    wrongAnswers: number;
  }>
) {
  const db = await getDb();
  if (!db) return;
  await db.update(practiceSessions).set(data).where(eq(practiceSessions.id, id));
}

export async function recordAnswer(answer: InsertSessionAnswer) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(sessionAnswers).values(answer);
}

// ── User Progress ──────────────────────────────────────────────────

export async function upsertProgress(
  userId: number,
  topicId: number,
  isCorrect: boolean
) {
  const db = await getDb();
  if (!db) return;
  const existing = await db
    .select()
    .from(userProgress)
    .where(and(eq(userProgress.userId, userId), eq(userProgress.topicId, topicId)))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(userProgress).values({
      userId,
      topicId,
      totalAnswered: 1,
      totalCorrect: isCorrect ? 1 : 0,
      totalWrong: isCorrect ? 0 : 1,
      lastPracticed: new Date(),
    });
  } else {
    await db
      .update(userProgress)
      .set({
        totalAnswered: sql`totalAnswered + 1`,
        totalCorrect: isCorrect ? sql`totalCorrect + 1` : sql`totalCorrect`,
        totalWrong: isCorrect ? sql`totalWrong` : sql`totalWrong + 1`,
        lastPracticed: new Date(),
      })
      .where(and(eq(userProgress.userId, userId), eq(userProgress.topicId, topicId)));
  }
}

export async function getProgressByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      topicId: userProgress.topicId,
      topicName: topics.name,
      totalAnswered: userProgress.totalAnswered,
      totalCorrect: userProgress.totalCorrect,
      totalWrong: userProgress.totalWrong,
      lastPracticed: userProgress.lastPracticed,
    })
    .from(userProgress)
    .leftJoin(topics, eq(userProgress.topicId, topics.id))
    .where(eq(userProgress.userId, userId))
    .orderBy(desc(userProgress.totalAnswered));
}

export async function getOverviewStats(userId: number) {
  const db = await getDb();
  if (!db) return { totalAnswered: 0, totalCorrect: 0, totalQuestions: 0, totalDocuments: 0 };

  const [progressAgg] = await db
    .select({
      totalAnswered: sql<number>`COALESCE(SUM(totalAnswered), 0)`,
      totalCorrect: sql<number>`COALESCE(SUM(totalCorrect), 0)`,
    })
    .from(userProgress)
    .where(eq(userProgress.userId, userId));

  const [qCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(questions)
    .where(and(eq(questions.userId, userId), eq(questions.active, true)));

  const [dCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(documents)
    .where(eq(documents.userId, userId));

  return {
    totalAnswered: Number(progressAgg?.totalAnswered ?? 0),
    totalCorrect: Number(progressAgg?.totalCorrect ?? 0),
    totalQuestions: Number(qCount?.count ?? 0),
    totalDocuments: Number(dCount?.count ?? 0),
  };
}

// ── Exam Sessions ──────────────────────────────────────────────────

export async function createExamSession(data: {
  userId: number;
  title: string;
  topicIds: number[];
  source: string;
  totalQuestions: number;
  penaltyPerError: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(examSessions).values({
    ...data,
    status: "in_progress",
  });
  return (result as { insertId: number }).insertId;
}

export async function getExamSession(id: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(examSessions)
    .where(and(eq(examSessions.id, id), eq(examSessions.userId, userId)))
    .limit(1);
  return result[0];
}

export async function listExamSessions(userId: number, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(examSessions)
    .where(eq(examSessions.userId, userId))
    .orderBy(desc(examSessions.startedAt))
    .limit(limit);
}

export async function finishExamSession(
  id: number,
  userId: number,
  data: {
    correctAnswers: number;
    wrongAnswers: number;
    blankAnswers: number;
    rawScore: string;
    finalScore: string;
    finishedAt: Date;
  }
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(examSessions)
    .set({ ...data, status: "finished" })
    .where(and(eq(examSessions.id, id), eq(examSessions.userId, userId)));
}

export async function recordExamAnswer(data: {
  examSessionId: number;
  questionId: number;
  userId: number;
  selectedOption: "A" | "B" | "C" | "D" | "blank";
  isCorrect: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(examAnswers).values(data);
}

export async function getExamAnswers(examSessionId: number, userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: examAnswers.id,
      questionId: examAnswers.questionId,
      selectedOption: examAnswers.selectedOption,
      isCorrect: examAnswers.isCorrect,
      answeredAt: examAnswers.answeredAt,
      question: questions.question,
      optionA: questions.optionA,
      optionB: questions.optionB,
      optionC: questions.optionC,
      optionD: questions.optionD,
      correctOption: questions.correctOption,
      explanation: questions.explanation,
      topicId: questions.topicId,
      topicName: topics.name,
      difficulty: questions.difficulty,
    })
    .from(examAnswers)
    .innerJoin(questions, eq(examAnswers.questionId, questions.id))
    .leftJoin(topics, eq(questions.topicId, topics.id))
    .where(and(eq(examAnswers.examSessionId, examSessionId), eq(examAnswers.userId, userId)));
}

// ── Stats with date range ──────────────────────────────────────────

export async function getOverviewStatsByRange(
  userId: number,
  fromDate?: Date,
  toDate?: Date
) {
  const db = await getDb();
  if (!db) return { totalAnswered: 0, totalCorrect: 0, totalQuestions: 0, totalDocuments: 0, totalExams: 0 };

  // Count answers in date range from sessionAnswers
  const answerConditions = [eq(sessionAnswers.userId, userId)];
  if (fromDate) answerConditions.push(sql`${sessionAnswers.answeredAt} >= ${fromDate}`);
  if (toDate) answerConditions.push(sql`${sessionAnswers.answeredAt} <= ${toDate}`);

  const [answerAgg] = await db
    .select({
      totalAnswered: sql<number>`COUNT(*)`,
      totalCorrect: sql<number>`SUM(CASE WHEN ${sessionAnswers.isCorrect} = 1 THEN 1 ELSE 0 END)`,
    })
    .from(sessionAnswers)
    .where(and(...answerConditions));

  // Also count exam answers in range
  const examConditions = [eq(examAnswers.userId, userId)];
  if (fromDate) examConditions.push(sql`${examAnswers.answeredAt} >= ${fromDate}`);
  if (toDate) examConditions.push(sql`${examAnswers.answeredAt} <= ${toDate}`);

  const [examAgg] = await db
    .select({
      totalAnswered: sql<number>`COUNT(*)`,
      totalCorrect: sql<number>`SUM(CASE WHEN ${examAnswers.isCorrect} = 1 THEN 1 ELSE 0 END)`,
    })
    .from(examAnswers)
    .where(and(...examConditions));

  const totalAnswered = Number(answerAgg?.totalAnswered ?? 0) + Number(examAgg?.totalAnswered ?? 0);
  const totalCorrect = Number(answerAgg?.totalCorrect ?? 0) + Number(examAgg?.totalCorrect ?? 0);

  const [qCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(questions)
    .where(and(eq(questions.userId, userId), eq(questions.active, true)));

  const [dCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(documents)
    .where(eq(documents.userId, userId));

  const examSessionConditions = [eq(examSessions.userId, userId), eq(examSessions.status, "finished")];
  if (fromDate) examSessionConditions.push(sql`${examSessions.finishedAt} >= ${fromDate}`);
  if (toDate) examSessionConditions.push(sql`${examSessions.finishedAt} <= ${toDate}`);

  const [eCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(examSessions)
    .where(and(...examSessionConditions));

  return {
    totalAnswered,
    totalCorrect,
    totalQuestions: Number(qCount?.count ?? 0),
    totalDocuments: Number(dCount?.count ?? 0),
    totalExams: Number(eCount?.count ?? 0),
  };
}

export async function getProgressByUserAndRange(
  userId: number,
  fromDate?: Date,
  toDate?: Date
) {
  const db = await getDb();
  if (!db) return [];

  // If no date filter, use the existing aggregated table
  if (!fromDate && !toDate) {
    return db
      .select({
        topicId: userProgress.topicId,
        topicName: topics.name,
        totalAnswered: userProgress.totalAnswered,
        totalCorrect: userProgress.totalCorrect,
        totalWrong: userProgress.totalWrong,
        lastPracticed: userProgress.lastPracticed,
      })
      .from(userProgress)
      .leftJoin(topics, eq(userProgress.topicId, topics.id))
      .where(eq(userProgress.userId, userId))
      .orderBy(desc(userProgress.totalAnswered));
  }

  // With date filter: aggregate from raw answers
  const conditions = [eq(sessionAnswers.userId, userId)];
  if (fromDate) conditions.push(sql`${sessionAnswers.answeredAt} >= ${fromDate}`);
  if (toDate) conditions.push(sql`${sessionAnswers.answeredAt} <= ${toDate}`);

  return db
    .select({
      topicId: questions.topicId,
      topicName: topics.name,
      totalAnswered: sql<number>`COUNT(*)`,
      totalCorrect: sql<number>`SUM(CASE WHEN ${sessionAnswers.isCorrect} = 1 THEN 1 ELSE 0 END)`,
      totalWrong: sql<number>`SUM(CASE WHEN ${sessionAnswers.isCorrect} = 0 THEN 1 ELSE 0 END)`,
      lastPracticed: sql<Date>`MAX(${sessionAnswers.answeredAt})`,
    })
    .from(sessionAnswers)
    .innerJoin(questions, eq(sessionAnswers.questionId, questions.id))
    .leftJoin(topics, eq(questions.topicId, topics.id))
    .where(and(...conditions))
    .groupBy(questions.topicId, topics.name)
    .orderBy(sql`COUNT(*) DESC`);
}

export async function getDailyAccuracy(userId: number, days: number = 30) {
  const db = await getDb();
  if (!db) return [];

  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Aggregate practice answers by day
  const practiceRows = await db
    .select({
      day: sql<string>`DATE(answeredAt) AS day_bucket`,
      total: sql<number>`COUNT(*) AS total_count`,
      correct: sql<number>`SUM(CASE WHEN isCorrect = 1 THEN 1 ELSE 0 END) AS correct_count`,
    })
    .from(sessionAnswers)
    .where(and(eq(sessionAnswers.userId, userId), sql`answeredAt >= ${from}`))
    .groupBy(sql`DATE(answeredAt)`);

  // Aggregate exam answers by day
  const examRows = await db
    .select({
      day: sql<string>`DATE(answeredAt) AS day_bucket`,
      total: sql<number>`COUNT(*) AS total_count`,
      correct: sql<number>`SUM(CASE WHEN isCorrect = 1 THEN 1 ELSE 0 END) AS correct_count`,
    })
    .from(examAnswers)
    .where(and(eq(examAnswers.userId, userId), sql`answeredAt >= ${from}`))
    .groupBy(sql`DATE(answeredAt)`);

  // Merge by day
  const byDay: Record<string, { total: number; correct: number }> = {};
  for (const r of practiceRows) {
    if (!byDay[r.day]) byDay[r.day] = { total: 0, correct: 0 };
    byDay[r.day].total += Number(r.total);
    byDay[r.day].correct += Number(r.correct);
  }
  for (const r of examRows) {
    if (!byDay[r.day]) byDay[r.day] = { total: 0, correct: 0 };
    byDay[r.day].total += Number(r.total);
    byDay[r.day].correct += Number(r.correct);
  }

  return Object.entries(byDay)
    .map(([day, v]) => ({
      day,
      total: v.total,
      correct: v.correct,
      pct: v.total > 0 ? Math.round((v.correct / v.total) * 100) : 0,
    }))
    .sort((a, b) => a.day.localeCompare(b.day));
}
