import { beforeEach, describe, expect, it, vi } from "vitest";

const queryBuilder = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  gt: vi.fn().mockReturnThis(),
  limit: vi.fn().mockResolvedValue({ data: [{ user_id: "u1" }], error: null }),
  maybeSingle: vi.fn(),
  single: vi.fn(),
};

const mockSupabase = {
  from: vi.fn(() => queryBuilder),
  rpc: vi.fn(),
};

vi.mock("@/lib/supabase-universal", () => ({
  getSupabaseUniversalClient: vi.fn(() => mockSupabase),
}));

vi.mock("@/lib/auth-universal", () => ({
  getCurrentUserUniversal: vi.fn(() => Promise.resolve({ id: "u1", email: "u1@example.com" })),
}));

describe("paywall.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    queryBuilder.limit.mockResolvedValue({ data: [{ user_id: "u1" }], error: null });
  });

  it("hasPurchasedPost 在有记录时返回 true", async () => {
    queryBuilder.maybeSingle.mockResolvedValue({ data: { id: "p1" }, error: null });
    const { hasPurchasedPost } = await import("@/lib/paywall");
    await expect(hasPurchasedPost("fan-1", "post-1")).resolves.toBe(true);
  });

  it("isActiveSubscriber 在无 fanId 时返回 false", async () => {
    const { isActiveSubscriber } = await import("@/lib/paywall");
    await expect(isActiveSubscriber(null, "creator-1")).resolves.toBe(false);
  });

  it("canViewPost 对 creator 自己的帖子返回 true", async () => {
    queryBuilder.single.mockResolvedValue({
      data: { id: "post-1", creator_id: "u1", price_cents: 0 },
      error: null,
    });
    const { canViewPost } = await import("@/lib/paywall");
    await expect(canViewPost("post-1", "u1")).resolves.toBe(true);
  });
});
