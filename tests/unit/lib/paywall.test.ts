/**
 * Paywall 模块单元测试
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase client
const mockSupabase = {
  auth: {
    getUser: vi.fn(),
    getSession: vi.fn(),
  },
  from: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(),
  })),
  rpc: vi.fn(),
};

// Mock Next.js cookies API
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  })),
}));

vi.mock("@/lib/supabase-universal", () => ({
  getSupabaseUniversalClient: vi.fn(() => mockSupabase),
}));

vi.mock("@/lib/supabase-server", () => ({
  getSupabaseServerClient: vi.fn(() => mockSupabase),
}));

vi.mock("@/lib/auth-universal", () => ({
  getCurrentUserUniversal: vi.fn(() =>
    Promise.resolve({ id: "user-123", email: "test@example.com" })
  ),
}));

describe("Paywall Module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("canViewPost", () => {
    it("应该允许查看免费帖子", async () => {
      const { canViewPost } = await import("@/lib/paywall");

      const result = await canViewPost("user-123", {
        id: "post-1",
        creator_id: "creator-1",
        visibility: "free",
        price_cents: null,
      });

      expect(result).toBe(true);
    });

    it("应该允许 Creator 查看自己的帖子", async () => {
      const { canViewPost } = await import("@/lib/paywall");

      const result = await canViewPost("creator-1", {
        id: "post-2",
        creator_id: "creator-1",
        visibility: "ppv",
        price_cents: 500,
      });

      expect(result).toBe(true);
    });

    it("应该拒绝未订阅用户查看订阅帖子", async () => {
      mockSupabase.from().single.mockResolvedValue({
        data: null,
        error: { code: "PGRST116" },
      });

      const { canViewPost } = await import("@/lib/paywall");

      const result = await canViewPost("fan-1", {
        id: "post-3",
        creator_id: "creator-2",
        visibility: "subscribers",
        price_cents: null,
      });

      expect(result).toBe(false);
    });

    it("应该允许已订阅用户查看订阅帖子", async () => {
      mockSupabase.from().single.mockResolvedValue({
        data: { id: "sub-1", status: "active" },
        error: null,
      });

      const { canViewPost } = await import("@/lib/paywall");

      const result = await canViewPost("fan-2", {
        id: "post-4",
        creator_id: "creator-3",
        visibility: "subscribers",
        price_cents: null,
      });

      expect(result).toBe(true);
    });

    it("应该拒绝未购买用户查看 PPV 帖子", async () => {
      mockSupabase.from().single.mockResolvedValue({
        data: null,
        error: { code: "PGRST116" },
      });

      const { canViewPost } = await import("@/lib/paywall");

      const result = await canViewPost("fan-3", {
        id: "post-5",
        creator_id: "creator-4",
        visibility: "ppv",
        price_cents: 1000,
      });

      expect(result).toBe(false);
    });

    it("应该允许已购买用户查看 PPV 帖子", async () => {
      mockSupabase.from().single.mockResolvedValue({
        data: { id: "purchase-1", post_id: "post-6" },
        error: null,
      });

      const { canViewPost } = await import("@/lib/paywall");

      const result = await canViewPost("fan-4", {
        id: "post-6",
        creator_id: "creator-5",
        visibility: "ppv",
        price_cents: 500,
      });

      expect(result).toBe(true);
    });
  });

  describe("isActiveSubscriber", () => {
    it("应该返回 true 对于活跃订阅", async () => {
      mockSupabase.from().single.mockResolvedValue({
        data: { id: "sub-2", status: "active" },
        error: null,
      });

      const { isActiveSubscriber } = await import("@/lib/paywall");

      const result = await isActiveSubscriber("fan-5", "creator-6");

      expect(result).toBe(true);
    });

    it("应该返回 false 对于无订阅", async () => {
      mockSupabase.from().single.mockResolvedValue({
        data: null,
        error: { code: "PGRST116" },
      });

      const { isActiveSubscriber } = await import("@/lib/paywall");

      const result = await isActiveSubscriber("fan-6", "creator-7");

      expect(result).toBe(false);
    });
  });

  describe("hasPurchasedPost", () => {
    it("应该返回 true 对于已购买帖子", async () => {
      mockSupabase.from().single.mockResolvedValue({
        data: { id: "purchase-2", post_id: "post-7" },
        error: null,
      });

      const { hasPurchasedPost } = await import("@/lib/paywall");

      const result = await hasPurchasedPost("fan-7", "post-7");

      expect(result).toBe(true);
    });

    it("应该返回 false 对于未购买帖子", async () => {
      mockSupabase.from().single.mockResolvedValue({
        data: null,
        error: { code: "PGRST116" },
      });

      const { hasPurchasedPost } = await import("@/lib/paywall");

      const result = await hasPurchasedPost("fan-8", "post-8");

      expect(result).toBe(false);
    });
  });
});
