import { beforeEach, describe, expect, it, vi } from "vitest";

const spendWalletOnPpv = vi.fn();
const single = vi.fn();
const postQuery = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single,
};

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdminClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table !== "posts") throw new Error(`unexpected table: ${table}`);
      return postQuery;
    }),
  })),
}));

vi.mock("@/lib/wallet-spend", () => ({ spendWalletOnPpv }));
vi.mock("@/lib/auth-universal", () => ({ getCurrentUserUniversal: vi.fn() }));

describe("unlockPost authoritative quote", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    postQuery.select.mockReturnThis();
    postQuery.eq.mockReturnThis();
    single.mockResolvedValue({
      data: {
        id: "post-1",
        price_cents: 2500,
        visibility: "ppv",
        creator_id: "creator-1",
      },
      error: null,
    });
    spendWalletOnPpv.mockResolvedValue({
      success: true,
      balanceAfterCents: 7500,
    });
  });

  it("charges the price and creator read from the post row", async () => {
    const { unlockPost } = await import("@/lib/paywall");

    await expect(unlockPost("post-1", "idem-1", "fan-1")).resolves.toEqual({
      success: true,
      balance_after_cents: 7500,
    });

    expect(spendWalletOnPpv).toHaveBeenCalledWith(
      expect.objectContaining({
        fanId: "fan-1",
        postId: "post-1",
        creatorId: "creator-1",
        priceCents: 2500,
        idempotencyKey: "idem-1",
      })
    );
  });
});
