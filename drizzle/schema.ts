import {
  boolean,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  json,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  // GitHub sync config
  githubRepo: varchar("githubRepo", { length: 255 }),
  githubToken: text("githubToken"),
  githubBranch: varchar("githubBranch", { length: 128 }).default("main"),
  lastGithubSync: timestamp("lastGithubSync"),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Documentos PDF subidos (convocatoria, exámenes anteriores, etc.)
export const documents = mysqlTable("documents", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  type: mysqlEnum("type", ["convocatoria", "examen", "tema", "otro"]).default("otro").notNull(),
  storageKey: varchar("storageKey", { length: 512 }).notNull(),
  storageUrl: varchar("storageUrl", { length: 1024 }).notNull(),
  fileSize: int("fileSize"),
  pageCount: int("pageCount"),
  year: varchar("year", { length: 10 }),
  processed: boolean("processed").default(false).notNull(),
  processingError: text("processingError"),
  githubPath: varchar("githubPath", { length: 512 }), // ruta en el repo de GitHub
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Document = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;

// Bloques temáticos
export const topics = mysqlTable("topics", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  order: int("order").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Topic = typeof topics.$inferSelect;
export type InsertTopic = typeof topics.$inferInsert;

// Banco de preguntas tipo test
export const questions = mysqlTable("questions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  documentId: int("documentId"), // null si es generada por IA sin documento
  topicId: int("topicId"),
  source: mysqlEnum("source", ["extracted", "ai_generated"]).default("ai_generated").notNull(),
  question: text("question").notNull(),
  optionA: text("optionA").notNull(),
  optionB: text("optionB").notNull(),
  optionC: text("optionC").notNull(),
  optionD: text("optionD").notNull(),
  correctOption: mysqlEnum("correctOption", ["A", "B", "C", "D"]).notNull(),
  explanation: text("explanation"), // explicación IA de la respuesta correcta
  difficulty: mysqlEnum("difficulty", ["facil", "medio", "dificil"]).default("medio"),
  tags: json("tags").$type<string[]>().default([]),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Question = typeof questions.$inferSelect;
export type InsertQuestion = typeof questions.$inferInsert;

// Sesiones de práctica
export const practiceSessions = mysqlTable("practiceSessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  finishedAt: timestamp("finishedAt"),
  totalQuestions: int("totalQuestions").default(0).notNull(),
  correctAnswers: int("correctAnswers").default(0).notNull(),
  wrongAnswers: int("wrongAnswers").default(0).notNull(),
  filterTopicId: int("filterTopicId"),
  filterSource: varchar("filterSource", { length: 32 }),
});

export type PracticeSession = typeof practiceSessions.$inferSelect;
export type InsertPracticeSession = typeof practiceSessions.$inferInsert;

// Respuestas individuales dentro de una sesión
export const sessionAnswers = mysqlTable("sessionAnswers", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  questionId: int("questionId").notNull(),
  userId: int("userId").notNull(),
  selectedOption: mysqlEnum("selectedOption", ["A", "B", "C", "D"]).notNull(),
  isCorrect: boolean("isCorrect").notNull(),
  answeredAt: timestamp("answeredAt").defaultNow().notNull(),
});

export type SessionAnswer = typeof sessionAnswers.$inferSelect;
export type InsertSessionAnswer = typeof sessionAnswers.$inferInsert;

// Progreso acumulado por bloque temático
export const userProgress = mysqlTable("userProgress", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  topicId: int("topicId").notNull(),
  totalAnswered: int("totalAnswered").default(0).notNull(),
  totalCorrect: int("totalCorrect").default(0).notNull(),
  totalWrong: int("totalWrong").default(0).notNull(),
  lastPracticed: timestamp("lastPracticed"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserProgress = typeof userProgress.$inferSelect;
export type InsertUserProgress = typeof userProgress.$inferInsert;

// Sesiones de examen (modo examen, sin feedback inmediato)
export const examSessions = mysqlTable("examSessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  // Configuración del examen
  topicIds: json("topicIds").$type<number[]>().default([]),   // [] = todos los temas
  source: varchar("source", { length: 32 }).default("all"),  // all | extracted | ai_generated
  totalQuestions: int("totalQuestions").default(0).notNull(),
  penaltyPerError: varchar("penaltyPerError", { length: 16 }).default("0.25"), // fracción que resta por error
  // Resultados
  correctAnswers: int("correctAnswers").default(0).notNull(),
  wrongAnswers: int("wrongAnswers").default(0).notNull(),
  blankAnswers: int("blankAnswers").default(0).notNull(),
  rawScore: varchar("rawScore", { length: 16 }),    // puntuación bruta (sobre totalQuestions)
  finalScore: varchar("finalScore", { length: 16 }), // puntuación con penalización
  status: varchar("status", { length: 16 }).default("in_progress").notNull(),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  finishedAt: timestamp("finishedAt"),
});

export type ExamSession = typeof examSessions.$inferSelect;
export type InsertExamSession = typeof examSessions.$inferInsert;

// Respuestas individuales de un examen
export const examAnswers = mysqlTable("examAnswers", {
  id: int("id").autoincrement().primaryKey(),
  examSessionId: int("examSessionId").notNull(),
  questionId: int("questionId").notNull(),
  userId: int("userId").notNull(),
  selectedOption: mysqlEnum("selectedOption", ["A", "B", "C", "D", "blank"]).notNull(),
  isCorrect: boolean("isCorrect").notNull(),
  answeredAt: timestamp("answeredAt").defaultNow().notNull(),
});

export type ExamAnswer = typeof examAnswers.$inferSelect;
export type InsertExamAnswer = typeof examAnswers.$inferInsert;
