import { beforeEach, describe, expect, it, vi } from "vitest";

const queryBuilder = {
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn(),
  single: vi.fn(),
};

const mockSupabase = {
  from: vi.fn(() => queryBuilder),
};

vi.mock("@/lib/supabase-browser", () => ({
  getSupabaseBrowserClient: vi.fn(() => mockSupabase),
}));

describe("wallet.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("getWalletBalance 返回 available/pending", async () => {
    queryBuilder.single.mockResolvedValueOnce({
      data: { available_balance_cents: 5000, pending_balance_cents: 2500 },
      error: null,
    });
    const { getWalletBalance } = await import("@/lib/wallet");
    await expect(getWalletBalance("user-1")).resolves.toEqual({ available: 50, pending: 25 });
  });

  it("deposit 在更新成功时返回 true", async () => {
    queryBuilder.single.mockResolvedValueOnce({
      data: { available_balance_cents: 1000 },
      error: null,
    });
    queryBuilder.update.mockReturnThis();
    const { deposit } = await import("@/lib/wallet");
    await expect(deposit("user-2", 10)).resolves.toBe(true);
  });

  it("getTransactions 返回交易数组", async () => {
    queryBuilder.limit.mockResolvedValueOnce({
      data: [
        {
          id: "tx-1",
          type: "deposit",
          amount_cents: 1000,
          status: "completed",
          created_at: "2024-01-01",
          metadata: null,
        },
      ],
      error: null,
    });
    const { getTransactions } = await import("@/lib/wallet");
    const txs = await getTransactions("user-3");
    expect(txs).toHaveLength(1);
    expect(txs[0].id).toBe("tx-1");
  });
});
