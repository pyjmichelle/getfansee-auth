import { beforeEach, describe, expect, it, vi } from "vitest";

const queryBuilder = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  gt: vi.fn().mockReturnThis(),
  limit: vi.fn().mockResolvedValue({ data: [{ user_id: "u1" }], error: null }),
  maybeSingle: vi.fn(),
  single: vi.fn(),
  upsert: vi.fn().mockResolvedValue({ error: null }),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
};

const mockSupabase = {
  from: vi.fn(() => queryBuilder),
  rpc: vi.fn(),
};

vi.mock("@/lib/supabase-universal", () => ({
  getSupabaseUniversalClient: vi.fn(() => mockSupabase),
}));

// subscribe30d / cancelSubscription write through the service-role client now
// that `subscriptions` has no fan-facing write policy (migration 055). Point it
// at the same builder so the write assertions below still hold.
vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdminClient: vi.fn(() => mockSupabase),
}));

vi.mock("@/lib/auth-universal", () => ({
  getCurrentUserUniversal: vi.fn(() => Promise.resolve({ id: "u1", email: "u1@example.com" })),
}));

describe("paywall.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    queryBuilder.limit.mockResolvedValue({ data: [{ user_id: "u1" }], error: null });
    queryBuilder.upsert.mockResolvedValue({ error: null });
    queryBuilder.update.mockReturnThis();
    queryBuilder.delete.mockReturnThis();
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

  it("subscribe30d 返回所授予周期的结束时间", async () => {
    const { subscribe30d } = await import("@/lib/paywall");
    const periodEnd = await subscribe30d("creator-1");

    expect(periodEnd).not.toBeNull();
    const grantedDays = (Date.parse(periodEnd as string) - Date.now()) / 86_400_000;
    expect(grantedDays).toBeCloseTo(30, 1);
    expect(queryBuilder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ status: "active", current_period_end: periodEnd }),
      expect.anything()
    );
  });

  it("subscribe30d 在 upsert 失败时返回 null（路由据此不扣款）", async () => {
    queryBuilder.upsert.mockResolvedValue({ error: { message: "boom" } });
    const { subscribe30d } = await import("@/lib/paywall");
    await expect(subscribe30d("creator-1")).resolves.toBeNull();
  });

  // Security regression guard (migration 055): the write must go through the
  // service-role client. If someone routes it back through the anon+JWT client,
  // the fan-writable-subscriptions bypass reopens.
  it("subscribe30d 走 service-role admin 客户端，而非 anon+JWT 客户端", async () => {
    const { getSupabaseAdminClient } = await import("@/lib/supabase-admin");
    const { getSupabaseUniversalClient } = await import("@/lib/supabase-universal");
    const { subscribe30d } = await import("@/lib/paywall");

    await subscribe30d("creator-1");

    expect(getSupabaseAdminClient).toHaveBeenCalled();
    expect(getSupabaseUniversalClient).not.toHaveBeenCalled();
  });

  it("cancelSubscription 同样走 admin 客户端并按 (user, creator) 收窄", async () => {
    const { getSupabaseAdminClient } = await import("@/lib/supabase-admin");
    const { getSupabaseUniversalClient } = await import("@/lib/supabase-universal");
    const { cancelSubscription } = await import("@/lib/paywall");

    await expect(cancelSubscription("creator-1")).resolves.toBe(true);

    expect(getSupabaseAdminClient).toHaveBeenCalled();
    expect(getSupabaseUniversalClient).not.toHaveBeenCalled();
    expect(queryBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "canceled" })
    );
    expect(queryBuilder.eq).toHaveBeenCalledWith("creator_id", "creator-1");
  });
});
