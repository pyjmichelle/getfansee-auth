import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdminClient: () => ({ rpc }) }));
beforeEach(() => rpc.mockReset());

describe("creator withdrawable earnings", () => {
  it("surfaces earned refund debt independently of funded balance", async () => {
    rpc.mockResolvedValue({
      data: { available_cents: 0, pending_cents: 500, debt_cents: 3000 },
      error: null,
    });
    const { getCreatorWalletBalances } = await import("@/lib/payouts");
    await expect(getCreatorWalletBalances("creator-1")).resolves.toEqual({
      availableCents: 0,
      pendingCents: 500,
      debtCents: 3000,
    });
  });
  it("uses the earned-liability snapshot rather than personal funded wallet balance", async () => {
    rpc.mockResolvedValue({ data: { available_cents: 200, pending_cents: 800 }, error: null });
    const { getCreatorWalletBalances } = await import("@/lib/payouts");
    await expect(getCreatorWalletBalances("creator-1")).resolves.toEqual({
      availableCents: 200,
      pendingCents: 800,
      debtCents: 0,
    });
    expect(rpc).toHaveBeenCalledWith("creator_earned_balances", { p_creator_id: "creator-1" });
  });

  it("does not advertise funded balances as earnings when the ledger lookup fails", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "database unavailable" } });
    const { getCreatorWalletBalances } = await import("@/lib/payouts");
    await expect(getCreatorWalletBalances("creator-1")).resolves.toEqual({
      availableCents: 0,
      pendingCents: 0,
      debtCents: 0,
    });
  });
});
