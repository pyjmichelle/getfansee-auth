/**
 * 认证模块单元测试
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase client
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
  from: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(),
    upsert: vi.fn().mockReturnThis(),
  })),
};

// Mock Next.js cookies API
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  })),
}));

// Mock getSupabaseBrowserClient
vi.mock("@/lib/supabase-browser", () => ({
  getSupabaseBrowserClient: vi.fn(() => mockSupabase),
}));

// Mock getSupabaseServerClient
vi.mock("@/lib/supabase-server", () => ({
  getSupabaseServerClient: vi.fn(() => mockSupabase),
}));

// Mock auth-server
vi.mock("@/lib/auth-server", () => ({
  getCurrentUser: vi.fn(async () => ({
    id: "user-123",
    email: "test@example.com",
  })),
}));

describe("Auth Module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("ensureProfile", () => {
    it("应该为新用户创建 profile", async () => {
      // Mock: 用户存在但 profile 不存在
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { user: { id: "user-123", email: "test@example.com" } } },
        error: null,
      });

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: "user-123", email: "test@example.com" } },
        error: null,
      });

      mockSupabase.from().single.mockResolvedValueOnce({
        data: null,
        error: { code: "PGRST116" }, // Not found
      });

      mockSupabase.from().single.mockResolvedValueOnce({
        data: { id: "user-123", email: "test@example.com", role: "fan" },
        error: null,
      });

      const { ensureProfile } = await import("@/lib/auth");
      const profile = await ensureProfile();

      expect(profile).toBeDefined();
      expect(profile?.id).toBe("user-123");
    });

    it("应该跳过已存在的 profile", async () => {
      // Mock: 用户和 profile 都存在
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { user: { id: "user-456", email: "existing@example.com" } } },
        error: null,
      });

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: "user-456", email: "existing@example.com" } },
        error: null,
      });

      mockSupabase.from().single.mockResolvedValue({
        data: { id: "user-456", email: "existing@example.com", role: "creator" },
        error: null,
      });

      const { ensureProfile } = await import("@/lib/auth");
      const profile = await ensureProfile();

      expect(profile).toBeDefined();
      expect(profile?.role).toBe("creator");
    });

    it("应该在用户未登录时返回 null", async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const { ensureProfile } = await import("@/lib/auth");
      const profile = await ensureProfile();

      expect(profile).toBeNull();
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

      expect(result.data?.user).toBeDefined();
      expect(result.error).toBeNull();
    });

    it("应该处理注册错误", async () => {
      mockSupabase.auth.signUp.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: "User already registered" },
      });

      const { signUpWithEmail } = await import("@/lib/auth");
      const result = await signUpWithEmail("existing@example.com", "password123");

      expect(result.data?.user).toBeNull();
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

      expect(result.data?.user).toBeDefined();
      expect(result.error).toBeNull();
    });

    it("应该处理登录错误", async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: "Invalid credentials" },
      });

      const { signInWithEmail } = await import("@/lib/auth");
      const result = await signInWithEmail("wrong@example.com", "wrongpass");

      expect(result.data?.user).toBeNull();
      expect(result.error).toBeDefined();
    });
  });

  describe("signOut", () => {
    it("应该成功登出", async () => {
      mockSupabase.auth.signOut.mockResolvedValue({ error: null });

      const { signOut } = await import("@/lib/auth");
      const result = await signOut();

      expect(result.error).toBeNull();
      expect(mockSupabase.auth.signOut).toHaveBeenCalled();
    });
  });
});
