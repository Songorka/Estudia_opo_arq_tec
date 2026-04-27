import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext; clearedCookies: Array<{ name: string; options: Record<string, unknown> }> } {
  const clearedCookies: Array<{ name: string; options: Record<string, unknown> }> = [];

  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-openid",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    githubRepo: null,
    githubToken: null,
    githubBranch: "main",
    lastGithubSync: null,
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };

  return { ctx, clearedCookies };
}

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("auth.logout", () => {
  it("clears the session cookie and reports success", async () => {
    const { ctx, clearedCookies } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.logout();

    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
    expect(clearedCookies[0]?.options).toMatchObject({
      maxAge: -1,
      secure: true,
      sameSite: "none",
      httpOnly: true,
      path: "/",
    });
  });
});

describe("auth.me", () => {
  it("returns null for unauthenticated users", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("returns user for authenticated users", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).not.toBeNull();
    expect(result?.name).toBe("Test User");
  });
});

describe("stats.overview with date range", () => {
  it("accepts optional date range parameters", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    // Should not throw when called with date range params
    const result = await caller.stats.overview({
      from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      to: new Date().toISOString(),
    });
    expect(result).toHaveProperty("totalAnswered");
    expect(result).toHaveProperty("totalCorrect");
    expect(result).toHaveProperty("totalQuestions");
    expect(result).toHaveProperty("totalDocuments");
    expect(result).toHaveProperty("totalExams");
  });

  it("accepts empty params for full history", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.stats.overview({});
    expect(result).toHaveProperty("totalAnswered");
  });
});

describe("exam router", () => {
  it("exam.list returns an array", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.exam.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("exam.start throws NOT_FOUND when filtering by non-existent topicId", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    // Use a topicId that is guaranteed to have no questions (very large ID)
    await expect(
      caller.exam.start({
        title: "Test exam",
        topicIds: [999999],
        source: "all",
        count: 5,
        penaltyPerError: "0.25",
      })
    ).rejects.toThrow();
  });
});

describe("stats.evolution", () => {
  it("returns an array with day/total/correct/pct fields", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.stats.evolution({ days: 30 });
    expect(Array.isArray(result)).toBe(true);
    // If there are entries, they should have the expected shape
    if (result.length > 0) {
      expect(result[0]).toHaveProperty("day");
      expect(result[0]).toHaveProperty("total");
      expect(result[0]).toHaveProperty("correct");
      expect(result[0]).toHaveProperty("pct");
    }
  });

  it("accepts default params", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.stats.evolution({});
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("exam.getResult", () => {
  it("throws NOT_FOUND for non-existent exam session", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.exam.getResult({ examSessionId: 99999 })
    ).rejects.toThrow();
  });
});

describe("github.getConfig", () => {
  it("returns default config when no github settings", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.github.getConfig();
    expect(result.githubRepo).toBe("Songorka/Estudia_opo_arq_tec");
    expect(result.githubBranch).toBe("main");
  });
});
