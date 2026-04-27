/**
 * Tests for the new topic-selector and review-flag features.
 *
 * These tests run against the router layer using mocked DB helpers,
 * so they work without a real database connection.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { TrpcContext } from "./_core/context";

// ── Mock DB helpers ────────────────────────────────────────────────

vi.mock("./db", async (importOriginal) => {
  const original = await importOriginal<typeof import("./db")>();
  return {
    ...original,
    getRandomQuestions: vi.fn(),
    getTopics: vi.fn(),
    getProgressByUser: vi.fn(),
    setQuestionReviewFlag: vi.fn(),
    createSession: vi.fn(),
    getQuestionById: vi.fn(),
    recordAnswer: vi.fn(),
    upsertProgress: vi.fn(),
    updateSession: vi.fn(),
  };
});

import * as db from "./db";
import { appRouter } from "./routers";

// ── Helpers ────────────────────────────────────────────────────────

function createCtx(userId = 1): TrpcContext {
  return {
    user: {
      id: userId,
      openId: "test-user",
      email: "test@example.com",
      name: "Test User",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

const MOCK_QUESTION = {
  id: 1,
  userId: 1,
  topicId: 10,
  documentId: null,
  source: "ai_generated" as const,
  question: "¿Cuál es la norma CTE?",
  optionA: "A",
  optionB: "B",
  optionC: "C",
  optionD: "D",
  correctOption: "A" as const,
  explanation: "Explicación",
  difficulty: "medio" as const,
  tags: [],
  active: true,
  reviewFlag: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ── Tests ──────────────────────────────────────────────────────────

describe("questions.topicsWithCounts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns topics enriched with progress counts", async () => {
    vi.mocked(db.getTopics).mockResolvedValue([
      { id: 1, userId: 1, name: "Tema 1 — CTE", description: null, createdAt: new Date(), updatedAt: new Date() },
      { id: 2, userId: 1, name: "Tema 2 — LOE", description: null, createdAt: new Date(), updatedAt: new Date() },
    ]);
    vi.mocked(db.getProgressByUser).mockResolvedValue([
      { topicId: 1, totalAnswered: 10, totalCorrect: 7, totalWrong: 3, userId: 1, id: 1, createdAt: new Date(), updatedAt: new Date() },
    ]);

    const caller = appRouter.createCaller(createCtx());
    const result = await caller.questions.topicsWithCounts();

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ id: 1, name: "Tema 1 — CTE", totalAnswered: 10, totalCorrect: 7 });
    expect(result[1]).toMatchObject({ id: 2, totalAnswered: 0, totalCorrect: 0 });
  });
});

describe("questions.setReviewFlag", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls setQuestionReviewFlag with correct args", async () => {
    vi.mocked(db.setQuestionReviewFlag).mockResolvedValue(undefined);

    const caller = appRouter.createCaller(createCtx());
    await caller.questions.setReviewFlag({ id: 42, flag: true });

    expect(db.setQuestionReviewFlag).toHaveBeenCalledWith(42, 1, true);
  });

  it("can unset the review flag", async () => {
    vi.mocked(db.setQuestionReviewFlag).mockResolvedValue(undefined);

    const caller = appRouter.createCaller(createCtx());
    await caller.questions.setReviewFlag({ id: 42, flag: false });

    expect(db.setQuestionReviewFlag).toHaveBeenCalledWith(42, 1, false);
  });
});

describe("practice.startSession with topicIds", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches questions from each topic when topicIds is provided", async () => {
    vi.mocked(db.getRandomQuestions).mockResolvedValue([MOCK_QUESTION]);
    vi.mocked(db.createSession).mockResolvedValue(99);

    const caller = appRouter.createCaller(createCtx());
    const result = await caller.practice.startSession({ topicIds: [10, 20], count: 10 });

    // Should have called getRandomQuestions once per topic
    expect(db.getRandomQuestions).toHaveBeenCalledTimes(2);
    expect(result.sessionId).toBe(99);
    expect(result.questions.length).toBeGreaterThan(0);
  });

  it("throws NOT_FOUND when no questions available", async () => {
    vi.mocked(db.getRandomQuestions).mockResolvedValue([]);

    const caller = appRouter.createCaller(createCtx());
    await expect(
      caller.practice.startSession({ topicIds: [999], count: 5 })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
