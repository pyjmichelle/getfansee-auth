import { beforeEach, describe, expect, it, vi } from "vitest";

const queryBuilder = {
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  is: vi.fn().mockReturnThis(),
  order: vi.fn().mockResolvedValue({ data: [], error: null }),
  single: vi.fn(),
};

const mockSupabase = {
  from: vi.fn(() => queryBuilder),
};

vi.mock("@/lib/supabase-server", () => ({
  getSupabaseServerClient: vi.fn(() => mockSupabase),
}));

vi.mock("@/lib/auth-server", () => ({
  getCurrentUser: vi.fn(() => Promise.resolve({ id: "creator-1", email: "creator@example.com" })),
}));

vi.mock("@/lib/profile-server", () => ({
  getProfile: vi.fn(() =>
    Promise.resolve({
      id: "creator-1",
      role: "creator",
      age_verified: true,
      display_name: "Creator",
    })
  ),
}));

describe("posts.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("createPost 对 ppv 且价格为空返回失败", async () => {
    const { createPost } = await import("@/lib/posts");
    const result = await createPost({
      title: "ppv",
      content: "content",
      visibility: "ppv",
      price_cents: null,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("price");
    }
  });

  it("createPost 对 free 返回成功", async () => {
    queryBuilder.single.mockResolvedValueOnce({ data: { id: "post-1" }, error: null });
    const { createPost } = await import("@/lib/posts");
    const result = await createPost({
      title: "free",
      content: "content",
      visibility: "free",
    });
    expect(result).toEqual({ success: true, postId: "post-1" });
  });

  it("listCreatorPosts 返回数组", async () => {
    queryBuilder.order.mockResolvedValueOnce({
      data: [
        {
          id: "p1",
          creator_id: "creator-1",
          title: "Post 1",
          content: "c1",
          media_url: null,
          is_locked: false,
          visibility: "free",
          price_cents: 0,
          preview_enabled: false,
          watermark_enabled: true,
          created_at: new Date().toISOString(),
        },
      ],
      error: null,
    });
    const { listCreatorPosts } = await import("@/lib/posts");
    const posts = await listCreatorPosts("creator-1", null);
    expect(posts).toHaveLength(1);
    expect(posts[0].id).toBe("p1");
  });
});
