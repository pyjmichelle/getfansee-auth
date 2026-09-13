import { beforeEach, describe, expect, it, vi } from "vitest";

const countQuery = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  then: undefined as unknown,
};

const mockAdmin = {
  from: vi.fn(() => countQuery),
};

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdminClient: vi.fn(() => mockAdmin),
}));

/**
 * `eq()` is the last call in the chain, so it has to be the awaitable one.
 */
function resolveCountWith(result: { count: number | null; error: unknown }) {
  countQuery.eq.mockImplementation(() => ({
    eq: countQuery.eq,
    then: (onFulfilled: (value: unknown) => unknown) => Promise.resolve(result).then(onFulfilled),
  }));
}

describe("countSubscriptionOrders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    countQuery.select.mockReturnThis();
  });

  // This count is the sequence number in /api/subscribe's charge idempotency
  // key, so a wrong answer is a wrong charge in one direction or the other.
  it("按 (fan, creator, subscription) 统计既往订阅单数，作为扣款键序号", async () => {
    resolveCountWith({ count: 2, error: null });
    const { countSubscriptionOrders } = await import("@/lib/wallet-spend");

    await expect(countSubscriptionOrders("fan-1", "creator-1")).resolves.toBe(2);
    expect(mockAdmin.from).toHaveBeenCalledWith("consumption_orders");
    expect(countQuery.eq).toHaveBeenCalledWith("fan_id", "fan-1");
    expect(countQuery.eq).toHaveBeenCalledWith("creator_id", "creator-1");
    expect(countQuery.eq).toHaveBeenCalledWith("kind", "subscription");
  });

  it("无既往订阅单时返回 0（首购）", async () => {
    resolveCountWith({ count: null, error: null });
    const { countSubscriptionOrders } = await import("@/lib/wallet-spend");

    await expect(countSubscriptionOrders("fan-1", "creator-1")).resolves.toBe(0);
  });

  // 读失败必须与「零单」区分开：若把读失败当 0，键会退回首购那一个，
  // spend_wallet 命中 idempotent 分支报成功而其实没扣钱，粉丝白拿一个周期。
  it("读取失败返回 null 而非 0，让路由拒绝该次请求", async () => {
    resolveCountWith({ count: null, error: { message: "timeout" } });
    const { countSubscriptionOrders } = await import("@/lib/wallet-spend");

    await expect(countSubscriptionOrders("fan-1", "creator-1")).resolves.toBeNull();
  });
});
