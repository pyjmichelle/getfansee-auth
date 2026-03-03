import { beforeEach, describe, expect, it, vi } from "vitest";

const queryBuilder = {
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockResolvedValue({ error: null }),
  eq: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn(),
};

const mockSupabase = {
  auth: {
    getSession: vi.fn(),
    signUp: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
  },
  from: vi.fn(() => queryBuilder),
};

vi.mock("@/lib/supabase-browser", () => ({
  getSupabaseBrowserClient: vi.fn(() => mockSupabase),
}));

describe("auth.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("ensureProfile 在 profile 缺失时不会抛错", async () => {
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: "u1", email: "u1@example.com" } } },
      error: null,
    });
    queryBuilder.maybeSingle.mockResolvedValue({ data: null, error: null });

    const { ensureProfile } = await import("@/lib/auth");
    await expect(ensureProfile()).resolves.toBeUndefined();
    expect(queryBuilder.insert).toHaveBeenCalled();
  });

  it("signUpWithEmail 返回 success=true", async () => {
    mockSupabase.auth.signUp.mockResolvedValue({
      data: { session: { access_token: "token" } },
      error: null,
    });
    const { signUpWithEmail } = await import("@/lib/auth");
    await expect(signUpWithEmail("a@b.com", "Password123!")).resolves.toEqual({
      success: true,
      session: true,
    });
  });

  it("signInWithEmail 在错误时抛出异常", async () => {
    mockSupabase.auth.signInWithPassword.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: "Invalid credentials", name: "AuthApiError", status: 400 },
    });
    const { signInWithEmail } = await import("@/lib/auth");
    await expect(signInWithEmail("a@b.com", "bad")).rejects.toThrow("Invalid credentials");
  });

  it("signOut 成功调用 supabase.auth.signOut", async () => {
    mockSupabase.auth.signOut.mockResolvedValue({ error: null });
    const { signOut } = await import("@/lib/auth");
    await expect(signOut()).resolves.toBeUndefined();
    expect(mockSupabase.auth.signOut).toHaveBeenCalledTimes(1);
  });
});
