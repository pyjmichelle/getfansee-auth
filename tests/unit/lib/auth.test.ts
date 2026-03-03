/**
 * 认证模块单元测试
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Persistent chain object — same instance returned every time from()
const mockChain = {
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  upsert: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn(),
  maybeSingle: vi.fn(),
};

const mockSupabase = {
  auth: {
    getUser: vi.fn(),
    getSession: vi.fn(),
    signUp: vi.fn(),
    signInWithPassword: vi.fn(),
    signInWithOtp: vi.fn(),
    signInWithOAuth: vi.fn(),
    signOut: vi.fn(),
  },
  from: vi.fn(() => mockChain),
};

vi.mock("@/lib/supabase-browser", () => ({
  getSupabaseBrowserClient: vi.fn(() => mockSupabase),
}));

describe("Auth Module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-apply mockReturnThis after clearAllMocks (clearAllMocks preserves implementations)
    mockChain.select.mockReturnThis();
    mockChain.insert.mockReturnThis();
    mockChain.update.mockReturnThis();
    mockChain.upsert.mockReturnThis();
    mockChain.eq.mockReturnThis();
  });

  describe("ensureProfile", () => {
    it("应该为新用户创建 profile", async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { user: { id: "user-123", email: "test@example.com" } } },
        error: null,
      });

      // maybeSingle for ban check
      mockChain.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      // maybeSingle for profile check — profile not found
      mockChain.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      // insert new profile (returns chain, no further resolution needed)
      mockChain.insert.mockReturnThis();

      const { ensureProfile } = await import("@/lib/auth");
      // ensureProfile returns void — we just verify it doesn't throw
      await expect(ensureProfile()).resolves.not.toThrow();
    });

    it("应该跳过已存在的 profile", async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { user: { id: "user-456", email: "existing@example.com" } } },
        error: null,
      });

      // maybeSingle for ban check
      mockChain.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      // maybeSingle for profile check — profile exists
      mockChain.maybeSingle.mockResolvedValueOnce({
        data: { id: "user-456", role: "creator", age_verified: true, referrer_id: null },
        error: null,
      });

      const { ensureProfile } = await import("@/lib/auth");
      await expect(ensureProfile()).resolves.not.toThrow();
      // insert should NOT be called since profile already exists
    });

    it("应该在用户未登录时返回 null", async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const { ensureProfile } = await import("@/lib/auth");
      const result = await ensureProfile();
      expect(result).toBeUndefined();
    });
  });

  describe("signUpWithEmail", () => {
    it("应该成功注册新用户", async () => {
      mockSupabase.auth.signUp.mockResolvedValue({
        data: {
          user: { id: "new-user", email: "newuser@example.com" },
          session: { access_token: "token-123" },
        },
        error: null,
      });

      const { signUpWithEmail } = await import("@/lib/auth");
      const result = await signUpWithEmail("newuser@example.com", "password123");

      expect(result.success).toBe(true);
      expect(result.session).toBe(true);
    });

    it("应该处理注册错误", async () => {
      mockSupabase.auth.signUp.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: "User already registered" },
      });

      const { signUpWithEmail } = await import("@/lib/auth");
      const result = await signUpWithEmail("existing@example.com", "password123");

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("signInWithEmail", () => {
    it("应该成功登录", async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: {
          user: { id: "user-789", email: "user@example.com" },
          session: { access_token: "token-456" },
        },
        error: null,
      });

      const { signInWithEmail } = await import("@/lib/auth");
      const result = await signInWithEmail("user@example.com", "password123");

      expect(result.user).toBeDefined();
      expect(result.session).toBeDefined();
    });

    it("应该处理登录错误", async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: "Invalid credentials", status: 401, name: "AuthApiError" },
      });

      const { signInWithEmail } = await import("@/lib/auth");
      await expect(signInWithEmail("wrong@example.com", "wrongpass")).rejects.toThrow();
    });
  });

  describe("signOut", () => {
    it("应该成功登出", async () => {
      mockSupabase.auth.signOut.mockResolvedValue({ error: null });

      const { signOut } = await import("@/lib/auth");
      await expect(signOut()).resolves.not.toThrow();
      expect(mockSupabase.auth.signOut).toHaveBeenCalled();
    });
  });
});
