import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const from = vi.fn();

const mockAdmin = { rpc, from };

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdminClient: vi.fn(() => mockAdmin),
}));

describe("requestWithdrawal / decideWithdrawal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("happy path 调用 request_withdrawal 并回传 requestId", async () => {
    rpc.mockResolvedValue({
      data: {
        success: true,
        request_id: "wd-1",
        status: "requested",
        amount_cents: 2000,
        balance_cents: 8000,
      },
      error: null,
    });
    const { requestWithdrawal } = await import("@/lib/payouts");

    const result = await requestWithdrawal({
      creatorId: "creator-1",
      methodId: "method-1",
      amountCents: 2000,
      idempotencyKey: "wd_creator-1_abc",
    });

    expect(rpc).toHaveBeenCalledWith(
      "request_withdrawal",
      expect.objectContaining({
        p_creator_id: "creator-1",
        p_method_id: "method-1",
        p_amount_cents: 2000,
        p_idempotency_key: "wd_creator-1_abc",
      })
    );
    expect(result).toMatchObject({
      success: true,
      requestId: "wd-1",
      status: "requested",
      amountCents: 2000,
    });
  });

  it("低于最低提现额时不打 RPC", async () => {
    const { requestWithdrawal } = await import("@/lib/payouts");
    const { MINIMUM_PAYOUT_CENTS } = await import("@/lib/constants/fees");
    expect(MINIMUM_PAYOUT_CENTS).toBe(2000);

    const result = await requestWithdrawal({
      creatorId: "creator-1",
      methodId: "method-1",
      amountCents: 1999,
      idempotencyKey: "wd_too_small",
    });

    expect(rpc).not.toHaveBeenCalled();
    expect(result).toMatchObject({ success: false });
  });

  it("余额不足时透出 insufficient", async () => {
    rpc.mockResolvedValue({
      data: { success: false, error: "Insufficient balance", balance_cents: 500 },
      error: null,
    });
    const { requestWithdrawal } = await import("@/lib/payouts");

    const result = await requestWithdrawal({
      creatorId: "creator-1",
      methodId: "method-1",
      amountCents: 2000,
      idempotencyKey: "wd_nsf",
    });

    expect(result).toMatchObject({
      success: false,
      insufficient: true,
      balanceCents: 500,
    });
  });

  it("相同幂等键回 idempotent", async () => {
    rpc.mockResolvedValue({
      data: {
        success: true,
        idempotent: true,
        request_id: "wd-1",
        status: "requested",
        amount_cents: 2000,
      },
      error: null,
    });
    const { requestWithdrawal } = await import("@/lib/payouts");

    const result = await requestWithdrawal({
      creatorId: "creator-1",
      methodId: "method-1",
      amountCents: 2000,
      idempotencyKey: "wd_creator-1_abc",
    });

    expect(result).toMatchObject({ success: true, idempotent: true, requestId: "wd-1" });
  });

  it("approve 走 decide_withdrawal paid 并带上外部转账号", async () => {
    rpc.mockResolvedValue({
      data: { success: true, request_id: "wd-1", status: "paid" },
      error: null,
    });
    const { decideWithdrawal } = await import("@/lib/payouts");

    const result = await decideWithdrawal({
      requestId: "wd-1",
      decision: "paid",
      externalReference: "0xtx",
      reason: "sent",
      adminId: "admin-1",
    });

    expect(rpc).toHaveBeenCalledWith(
      "decide_withdrawal",
      expect.objectContaining({
        p_request_id: "wd-1",
        p_decision: "paid",
        p_external_reference: "0xtx",
        p_admin_id: "admin-1",
      })
    );
    expect(result).toMatchObject({ success: true, status: "paid" });
  });

  it("reject 走 decide_withdrawal rejected", async () => {
    rpc.mockResolvedValue({
      data: { success: true, request_id: "wd-1", status: "rejected" },
      error: null,
    });
    const { decideWithdrawal } = await import("@/lib/payouts");

    const result = await decideWithdrawal({
      requestId: "wd-1",
      decision: "rejected",
      reason: "mismatch",
      adminId: "admin-1",
    });

    expect(result).toMatchObject({ success: true, status: "rejected" });
  });
});
