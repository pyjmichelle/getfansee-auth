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

  // The subscribe route keys its wallet charge on this return value. When it was
  // a bare boolean the key could only be date-granular, and a same-day
  // re-subscribe deduped against the first charge — a free extra period.
  it("subscribe30d 返回所授予周期的结束时间，供扣款幂等键绑定", async () => {
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

  // 扣款失败回滚：授予前无行 → 删除（留下 canceled 行会伪造一段从未发生的订阅历史）；
  // 授予前有行 → 按快照写回，绝不把粉丝此前已付的有效周期一起作废。
  it("restoreSubscription 对授予前不存在的订阅执行删除", async () => {
    const { restoreSubscription } = await import("@/lib/paywall");
    await expect(restoreSubscription("creator-1", { existed: false })).resolves.toBe(true);
    expect(queryBuilder.delete).toHaveBeenCalled();
    expect(queryBuilder.update).not.toHaveBeenCalled();
  });

  it("restoreSubscription 对授予前已存在的订阅写回快照", async () => {
    const { restoreSubscription } = await import("@/lib/paywall");
    const snapshot = {
      existed: true as const,
      status: "active",
      currentPeriodEnd: "2026-10-01T00:00:00.000Z",
      cancelledAt: null,
    };

    await expect(restoreSubscription("creator-1", snapshot)).resolves.toBe(true);
    expect(queryBuilder.delete).not.toHaveBeenCalled();
    expect(queryBuilder.update).toHaveBeenCalledWith({
      status: "active",
      current_period_end: "2026-10-01T00:00:00.000Z",
      cancelled_at: null,
    });
  });
});
