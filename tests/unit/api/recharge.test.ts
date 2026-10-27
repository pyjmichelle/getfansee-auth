import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const { rpc, requireUser } = vi.hoisted(() => ({ rpc: vi.fn(), requireUser: vi.fn() }));
vi.mock("@/lib/authz", () => ({ requireUser }));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdminClient: () => ({ rpc }) }));
import { POST } from "@/app/api/wallet/recharge/route";
const request = (body: unknown) =>
  new NextRequest("http://localhost/api/wallet/recharge", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": "intent-1" },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("APP_ENV", "test");
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.stubEnv("E2E", "1");
  requireUser.mockResolvedValue({ user: { id: "fan-1" } });
  rpc.mockResolvedValue({
    data: { success: true, balance_cents: 1000, idempotent: false },
    error: null,
  });
});
afterEach(() => vi.unstubAllEnvs());
describe("mock recharge", () => {
  it("refuses hosted production before auth or database work", async () => {
    vi.stubEnv("APP_ENV", "production");
    expect((await POST(request({ amount: 10 }))).status).toBe(403);
    expect(requireUser).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
  it.each([null, {}, { amount: "10" }, { amount: -1 }, { amount: 501 }, { amount: 0.001 }])(
    "rejects invalid amounts %j",
    async (body) => {
      expect((await POST(request(body))).status).toBe(400);
      expect(rpc).not.toHaveBeenCalled();
    }
  );
  it("funds through one identity-bound atomic call", async () => {
    const res = await POST(request({ amount: 10 }));
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("recharge_wallet", {
      p_user_id: "fan-1",
      p_amount_cents: 1000,
      p_idempotency_key: "mock_fan-1_intent-1",
    });
    expect(await res.json()).toEqual({ success: true, balance: 10, idempotent: false });
  });
  it("never reports success when the atomic transaction fails", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "rollback" } });
    expect((await POST(request({ amount: 10 }))).status).toBe(500);
  });
});
