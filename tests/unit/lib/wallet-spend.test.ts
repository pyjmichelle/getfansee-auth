import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const profileQuery = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
};

const mockAdmin = {
  rpc,
  from: vi.fn(() => profileQuery),
};

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdminClient: vi.fn(() => mockAdmin),
}));

describe("spendWalletOnSubscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    profileQuery.select.mockReturnThis();
    profileQuery.eq.mockReturnThis();
    profileQuery.maybeSingle.mockResolvedValue({ data: null, error: null });
  });

  // The debit and the `subscriptions` row must commit together, which is only
  // true if the route goes through this RPC rather than charging and then
  // writing the subscription over a second connection.
  it("走 spend_wallet_on_subscription 一次原子调用，并带上 30 天周期", async () => {
    rpc.mockResolvedValue({
      data: {
        success: true,
        consumption_order_id: "order-1",
        subscription_id: "sub-1",
        current_period_end: "2026-10-13T00:00:00.000Z",
        balance_after_cents: 4000,
      },
      error: null,
    });
    const { spendWalletOnSubscription, SUBSCRIPTION_PERIOD_DAYS } =
      await import("@/lib/wallet-spend");

    const result = await spendWalletOnSubscription({
      fanId: "fan-1",
      creatorId: "creator-1",
      priceCents: 1000,
      idempotencyKey: "sub_fan-1_creator-1_abc",
    });

    expect(rpc).toHaveBeenCalledWith(
      "spend_wallet_on_subscription",
      expect.objectContaining({
        p_fan_id: "fan-1",
        p_creator_id: "creator-1",
        p_price_cents: 1000,
        p_idempotency_key: "sub_fan-1_creator-1_abc",
        p_period_days: SUBSCRIPTION_PERIOD_DAYS,
      })
    );
    expect(result).toMatchObject({
      success: true,
      subscriptionId: "sub-1",
      currentPeriodEnd: "2026-10-13T00:00:00.000Z",
      alreadySubscribed: false,
    });
  });

  // 粉丝已在有效期内时 RPC 不扣款；路由据此回 alreadySubscribed，
  // 所以这个标志必须原样透出，不能被当成一次成功扣款。
  it("透出 already_subscribed，让路由知道这次没有扣款", async () => {
    rpc.mockResolvedValue({
      data: {
        success: true,
        idempotent: true,
        already_subscribed: true,
        subscription_id: "sub-1",
        balance_after_cents: 5000,
      },
      error: null,
    });
    const { spendWalletOnSubscription } = await import("@/lib/wallet-spend");

    await expect(
      spendWalletOnSubscription({
        fanId: "fan-1",
        creatorId: "creator-1",
        priceCents: 1000,
        idempotencyKey: "sub_fan-1_creator-1_def",
      })
    ).resolves.toMatchObject({ success: true, alreadySubscribed: true, idempotent: true });
  });

  it("余额不足时标记 insufficient，路由据此回 402", async () => {
    rpc.mockResolvedValue({
      data: { success: false, error: "Insufficient balance", balance_cents: 300 },
      error: null,
    });
    const { spendWalletOnSubscription } = await import("@/lib/wallet-spend");

    await expect(
      spendWalletOnSubscription({
        fanId: "fan-1",
        creatorId: "creator-1",
        priceCents: 1000,
        idempotencyKey: "sub_fan-1_creator-1_ghi",
      })
    ).resolves.toEqual({
      success: false,
      error: "Insufficient balance",
      balanceCents: 300,
      insufficient: true,
    });
  });
});
