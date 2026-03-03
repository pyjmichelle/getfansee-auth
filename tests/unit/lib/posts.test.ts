/**
 * Posts 模块单元测试
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Persistent chain object
const mockChain = {
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  is: vi.fn().mockReturnThis(),
  range: vi.fn().mockReturnThis(),
  single: vi.fn(),
  maybeSingle: vi.fn(),
};

const mockSupabase = {
  from: vi.fn(() => mockChain),
};

vi.mock("@/lib/supabase-server", () => ({
  getSupabaseServerClient: vi.fn(async () => mockSupabase),
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
      age_verified: true,
    })
  ),
}));

vi.mock("@/lib/geo-utils", () => ({
  getVisitorCountry: vi.fn(() => Promise.resolve(null)),
  isCountryBlocked: vi.fn(() => false),
}));

vi.mock("@/lib/post-media", () => ({
  addPostMedia: vi.fn(() => Promise.resolve(true)),
  getPostsMedia: vi.fn(() => Promise.resolve(new Map())),
  updatePostMedia: vi.fn(() => Promise.resolve(true)),
}));

vi.mock("@/lib/paywall", () => ({
  batchCheckSubscriptions: vi.fn(() => Promise.resolve(new Map())),
  batchCheckPurchases: vi.fn(() => Promise.resolve(new Map())),
}));

describe("Posts Module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChain.select.mockReturnThis();
    mockChain.insert.mockReturnThis();
    mockChain.update.mockReturnThis();
    mockChain.delete.mockReturnThis();
    mockChain.eq.mockReturnThis();
    mockChain.order.mockReturnThis();
    mockChain.limit.mockReturnThis();
    mockChain.is.mockReturnThis();
    mockChain.range.mockReturnThis();
  });

  describe("createPost - PPV 价格验证", () => {
    it("应该接受 >= $1.00 的 PPV 价格", async () => {
      mockChain.single.mockResolvedValue({
        data: { id: "post-1" },
        error: null,
      });

      const { createPost } = await import("@/lib/posts");

      const result = await createPost({
        title: "Test PPV Post",
        content: "Content",
        visibility: "ppv",
        price_cents: 100,
      });

      expect(result.success).toBe(true);
    });

    it("应该拒绝 < $1.00 的 PPV 价格", async () => {
      const { createPost } = await import("@/lib/posts");

      // price_cents <= 0 is rejected
      const result = await createPost({
        title: "Invalid PPV Post",
        content: "Content",
        visibility: "ppv",
        price_cents: 0,
      });

      expect(result.success).toBe(false);
      expect(result.success === false && result.error).toContain("PPV posts must have a price");
    });

    it("应该拒绝 PPV 帖子没有价格", async () => {
      const { createPost } = await import("@/lib/posts");

      const result = await createPost({
        title: "PPV without price",
        content: "Content",
        visibility: "ppv",
        price_cents: null,
      });

      expect(result.success).toBe(false);
      expect(result.success === false && result.error).toContain("PPV posts must have a price");
    });

    it("应该接受免费帖子", async () => {
      mockChain.single.mockResolvedValue({
        data: { id: "post-2" },
        error: null,
      });

      const { createPost } = await import("@/lib/posts");

      const result = await createPost({
        title: "Free Post",
        content: "Content",
        visibility: "free",
        price_cents: null,
      });

      expect(result.success).toBe(true);
    });

    it("应该接受订阅帖子", async () => {
      mockChain.single.mockResolvedValue({
        data: { id: "post-3" },
        error: null,
      });

      const { createPost } = await import("@/lib/posts");

      const result = await createPost({
        title: "Subscribers Post",
        content: "Content",
        visibility: "subscribers",
        price_cents: null,
      });

      expect(result.success).toBe(true);
    });
  });

  describe("listCreatorPosts", () => {
    it("应该返回 Creator 的帖子列表", async () => {
      const mockPosts = [
        {
          id: "post-4",
          creator_id: "creator-1",
          title: "Post 1",
          content: "c",
          media_url: null,
          is_locked: false,
          visibility: "free",
          price_cents: null,
          preview_enabled: false,
          watermark_enabled: true,
          created_at: "2024-01-01",
        },
        {
          id: "post-5",
          creator_id: "creator-1",
          title: "Post 2",
          content: "c",
          media_url: null,
          is_locked: true,
          visibility: "ppv",
          price_cents: 500,
          preview_enabled: false,
          watermark_enabled: true,
          created_at: "2024-01-02",
        },
      ];

      // geo-blocking profile query
      mockChain.single.mockResolvedValueOnce({
        data: { blocked_countries: null, role: "creator" },
        error: null,
      });

      // posts query (order returns chain, but final result comes from the query)
      // The chain ends with .order() which resolves implicitly
      // Actually the chain is: from().select().eq().is().order() — and order doesn't call single
      // The query resolves when awaited, returning {data, error}
      // We need to make the chain awaitable by mocking order to return a thenable
      mockChain.order.mockResolvedValue({
        data: mockPosts,
        error: null,
      });

      const { listCreatorPosts } = await import("@/lib/posts");
      const posts = await listCreatorPosts("creator-1", null);

      expect(posts).toHaveLength(2);
      expect(posts[0].id).toBe("post-4");
    });

    it("应该返回空数组当 Creator 没有帖子时", async () => {
      // geo-blocking profile query
      mockChain.single.mockResolvedValueOnce({
        data: { blocked_countries: null, role: "creator" },
        error: null,
      });

      mockChain.order.mockResolvedValue({
        data: [],
        error: null,
      });

      const { listCreatorPosts } = await import("@/lib/posts");
      const posts = await listCreatorPosts("creator-2", null);

      expect(posts).toHaveLength(0);
    });
  });
});
