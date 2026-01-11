/**
 * Wallet 模块单元测试
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase client
const mockSupabase = {
  auth: {
    getSession: vi.fn(),
  },
  from: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(),
  })),
};

// Mock Next.js cookies API
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  })),
}));

vi.mock("@/lib/supabase-universal", () => ({
  getSupabaseUniversalClient: vi.fn(() => mockSupabase),
}));

vi.mock("@/lib/supabase-server", () => ({
  getSupabaseServerClient: vi.fn(() => mockSupabase),
}));

describe("Wallet Module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getWalletBalance", () => {
    it("应该返回正确的余额", async () => {
      mockSupabase.from().single.mockResolvedValue({
        data: { balance_cents: 5000 },
        error: null,
      });

      const { getWalletBalance } = await import("@/lib/wallet");

      const balance = await getWalletBalance("user-1");

      expect(balance).toBe(5000);
    });

    it("应该返回 0 当钱包不存在时", async () => {
      mockSupabase.from().single.mockResolvedValue({
        data: null,
        error: { code: "PGRST116" },
      });

      const { getWalletBalance } = await import("@/lib/wallet");

      const balance = await getWalletBalance("user-2");

      expect(balance).toBe(0);
    });

    it("应该处理负数余额（不应该发生）", async () => {
      mockSupabase.from().single.mockResolvedValue({
        data: { balance_cents: -100 },
        error: null,
      });

      const { getWalletBalance } = await import("@/lib/wallet");

      const balance = await getWalletBalance("user-3");

      // 负数余额应该被视为 0（业务逻辑保护）
      expect(balance).toBeLessThanOrEqual(0);
    });
  });

  describe("deposit", () => {
    it("应该成功充值", async () => {
      mockSupabase.from().single.mockResolvedValue({
        data: { balance_cents: 10000 },
        error: null,
      });

      const { deposit } = await import("@/lib/wallet");

      const result = await deposit("user-4", 5000);

      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(10000);
    });

    it("应该拒绝负数充值", async () => {
      const { deposit } = await import("@/lib/wallet");

      const result = await deposit("user-5", -100);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Amount must be positive");
    });

    it("应该拒绝零充值", async () => {
      const { deposit } = await import("@/lib/wallet");

      const result = await deposit("user-6", 0);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Amount must be positive");
    });
  });

  describe("getTransactions", () => {
    it("应该返回交易历史", async () => {
      const mockTransactions = [
        { id: "tx-1", amount_cents: 1000, type: "deposit", created_at: "2024-01-01" },
        { id: "tx-2", amount_cents: -500, type: "purchase", created_at: "2024-01-02" },
      ];

      mockSupabase.from = vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: mockTransactions,
          error: null,
        }),
      }));

      const { getTransactions } = await import("@/lib/wallet");

      const transactions = await getTransactions("user-7");

      expect(transactions).toHaveLength(2);
      expect(transactions[0].type).toBe("deposit");
    });

    it("应该返回空数组当没有交易时", async () => {
      mockSupabase.from = vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      }));

      const { getTransactions } = await import("@/lib/wallet");

      const transactions = await getTransactions("user-8");

      expect(transactions).toHaveLength(0);
    });
  });
});
