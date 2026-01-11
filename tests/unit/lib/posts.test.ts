/**
 * Posts 模块单元测试
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase client
const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    single: vi.fn(),
  })),
};

vi.mock("@/lib/supabase-server", () => ({
  getSupabaseServerClient: vi.fn(() => mockSupabase),
}));

vi.mock("@/lib/auth-server", () => ({
  getCurrentUser: vi.fn(() => Promise.resolve({ id: "user-1", email: "test@example.com" })),
}));

vi.mock("@/lib/profile-server", () => ({
  getProfile: vi.fn(() =>
    Promise.resolve({
      id: "user-1",
      email: "test@example.com",
      role: "creator",
      display_name: "Test Creator",
    })
  ),
}));

describe("Posts Module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createPost - PPV 价格验证", () => {
    it("应该接受 >= $1.00 的 PPV 价格", async () => {
      mockSupabase.from().single.mockResolvedValue({
        data: { id: "post-1", price_cents: 100 },
        error: null,
      });

      const { createPost } = await import("@/lib/posts");

      const result = await createPost({
        title: "Test PPV Post",
        content: "Content",
        visibility: "ppv",
        priceCents: 100, // $1.00
      });

      expect(result.success).toBe(true);
    });

    it("应该拒绝 < $1.00 的 PPV 价格", async () => {
      const { createPost } = await import("@/lib/posts");

      const result = await createPost({
        title: "Invalid PPV Post",
        content: "Content",
        visibility: "ppv",
        priceCents: 50, // $0.50
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("PPV price must be at least $1.00");
    });

    it("应该拒绝 PPV 帖子没有价格", async () => {
      const { createPost } = await import("@/lib/posts");

      const result = await createPost({
        title: "PPV without price",
        content: "Content",
        visibility: "ppv",
        priceCents: null,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("PPV posts must have a price");
    });

    it("应该接受免费帖子", async () => {
      mockSupabase.from().single.mockResolvedValue({
        data: { id: "post-2", price_cents: null },
        error: null,
      });

      const { createPost } = await import("@/lib/posts");

      const result = await createPost({
        title: "Free Post",
        content: "Content",
        visibility: "free",
        priceCents: null,
      });

      expect(result.success).toBe(true);
    });

    it("应该接受订阅帖子", async () => {
      mockSupabase.from().single.mockResolvedValue({
        data: { id: "post-3", price_cents: null },
        error: null,
      });

      const { createPost } = await import("@/lib/posts");

      const result = await createPost({
        title: "Subscribers Post",
        content: "Content",
        visibility: "subscribers",
        priceCents: null,
      });

      expect(result.success).toBe(true);
    });
  });

  describe("listCreatorPosts", () => {
    it("应该返回 Creator 的帖子列表", async () => {
      const mockPosts = [
        { id: "post-4", title: "Post 1", visibility: "free" },
        { id: "post-5", title: "Post 2", visibility: "ppv" },
      ];

      mockSupabase.from = vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: mockPosts,
          error: null,
        }),
      }));

      const { listCreatorPosts } = await import("@/lib/posts");

      const posts = await listCreatorPosts("creator-1");

      expect(posts).toHaveLength(2);
      expect(posts[0].id).toBe("post-4");
    });

    it("应该返回空数组当 Creator 没有帖子时", async () => {
      mockSupabase.from = vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      }));

      const { listCreatorPosts } = await import("@/lib/posts");

      const posts = await listCreatorPosts("creator-2");

      expect(posts).toHaveLength(0);
    });
  });
});
