/**
 * Wallet 模块单元测试
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Persistent chain object
const mockChain = {
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn(),
  single: vi.fn(),
};

const mockSupabase = {
  auth: {
    getSession: vi.fn(),
  },
  from: vi.fn(() => mockChain),
};

// wallet.ts imports from supabase-browser (it has "use client")
vi.mock("@/lib/supabase-browser", () => ({
  getSupabaseBrowserClient: vi.fn(() => mockSupabase),
}));

describe("Wallet Module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChain.select.mockReturnThis();
    mockChain.insert.mockReturnThis();
    mockChain.update.mockReturnThis();
    mockChain.eq.mockReturnThis();
    mockChain.order.mockReturnThis();
  });

  describe("getWalletBalance", () => {
    it("应该返回正确的余额", async () => {
      mockChain.single.mockResolvedValue({
        data: { available_balance_cents: 5000, pending_balance_cents: 200 },
        error: null,
      });

      const { getWalletBalance } = await import("@/lib/wallet");
      const balance = await getWalletBalance("550e8400-e29b-41d4-a716-446655440001");

      expect(balance).toEqual({ available: 50, pending: 2 });
    });

    it("应该返回 0 当钱包不存在时", async () => {
      // First call: wallet not found
      mockChain.single.mockResolvedValueOnce({
        data: null,
        error: { code: "PGRST116" },
      });

      // Second call: insert + select returns new wallet
      mockChain.single.mockResolvedValueOnce({
        data: { available_balance_cents: 0, pending_balance_cents: 0 },
        error: null,
      });

      const { getWalletBalance } = await import("@/lib/wallet");
      const balance = await getWalletBalance("550e8400-e29b-41d4-a716-446655440002");

      expect(balance).toEqual({ available: 0, pending: 0 });
    });

    it("应该处理负数余额（不应该发生）", async () => {
      mockChain.single.mockResolvedValue({
        data: { available_balance_cents: -100, pending_balance_cents: 0 },
        error: null,
      });

      const { getWalletBalance } = await import("@/lib/wallet");
      const balance = await getWalletBalance("550e8400-e29b-41d4-a716-446655440003");

      expect(balance).toBeDefined();
      expect(balance!.available).toBeLessThanOrEqual(0);
    });
  });

  describe("deposit", () => {
    it("应该成功充值", async () => {
      // Wallet exists with balance
      mockChain.single.mockResolvedValue({
        data: { available_balance_cents: 5000 },
        error: null,
      });

      // update succeeds (eq returns chain, no error)
      mockChain.update.mockReturnThis();

      // insert transaction succeeds
      mockChain.insert.mockReturnThis();

      const { deposit } = await import("@/lib/wallet");
      const result = await deposit("550e8400-e29b-41d4-a716-446655440004", 50);

      expect(result).toBe(true);
    });

    it("应该处理钱包不存在时创建新钱包", async () => {
      // Wallet not found → PGRST116
      mockChain.single.mockResolvedValue({
        data: null,
        error: { code: "PGRST116" },
      });

      // insert new wallet succeeds
      mockChain.insert.mockReturnThis();

      const { deposit } = await import("@/lib/wallet");
      const result = await deposit("550e8400-e29b-41d4-a716-446655440005", 25);

      expect(result).toBe(true);
    });

    it("应该在数据库错误时返回 false", async () => {
      mockChain.single.mockResolvedValue({
        data: null,
        error: { code: "42P01", message: "relation does not exist" },
      });

      const { deposit } = await import("@/lib/wallet");
      const result = await deposit("550e8400-e29b-41d4-a716-446655440006", 10);

      expect(result).toBe(false);
    });
  });

  describe("getTransactions", () => {
    it("应该返回交易历史", async () => {
      const mockTransactions = [
        {
          id: "tx-1",
          type: "deposit",
          amount_cents: 1000,
          status: "completed",
          created_at: "2024-01-01",
          metadata: null,
        },
        {
          id: "tx-2",
          type: "purchase",
          amount_cents: -500,
          status: "completed",
          created_at: "2024-01-02",
          metadata: null,
        },
      ];

      mockChain.limit.mockResolvedValue({
        data: mockTransactions,
        error: null,
      });

      const { getTransactions } = await import("@/lib/wallet");
      const transactions = await getTransactions("550e8400-e29b-41d4-a716-446655440007");

      expect(transactions).toHaveLength(2);
      expect(transactions[0].type).toBe("deposit");
    });

    it("应该返回空数组当没有交易时", async () => {
      mockChain.limit.mockResolvedValue({
        data: [],
        error: null,
      });

      const { getTransactions } = await import("@/lib/wallet");
      const transactions = await getTransactions("550e8400-e29b-41d4-a716-446655440008");

      expect(transactions).toHaveLength(0);
    });
  });
});
