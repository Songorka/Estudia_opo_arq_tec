import { and, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  documents,
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

export async function ensureTopic(userId: number, name: string): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const existing = await db
    .select()
    .from(topics)
    .where(and(eq(topics.userId, userId), eq(topics.name, name)))
    .limit(1);
  if (existing.length > 0) return existing[0].id;
  const [result] = await db.insert(topics).values({ userId, name });
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
  opts?: { topicId?: number; source?: string; limit?: number; offset?: number }
) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(questions.userId, userId), eq(questions.active, true)];
  if (opts?.topicId) conditions.push(eq(questions.topicId, opts.topicId));
  if (opts?.source)
    conditions.push(
      eq(questions.source, opts.source as "extracted" | "ai_generated")
    );

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
  opts?: { topicId?: number; source?: string }
) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(questions.userId, userId), eq(questions.active, true)];
  if (opts?.topicId) conditions.push(eq(questions.topicId, opts.topicId));
  if (opts?.source)
    conditions.push(
      eq(questions.source, opts.source as "extracted" | "ai_generated")
    );

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
