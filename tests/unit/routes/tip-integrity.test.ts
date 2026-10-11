import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  spend: vi.fn(),
  geo: { country: "US", region: "CA" },
  rows: [] as Array<{ data: unknown; error: unknown }>,
}));
vi.mock("@/lib/auth-server", () => ({
  getCurrentUser: vi.fn(async () => ({ id: "11111111-1111-4111-8111-111111111111" })),
}));
vi.mock("@/lib/constants/alpha", () => ({ isInAppPaymentsEnabled: () => true }));
vi.mock("@/lib/wallet-spend", () => ({ spendWalletOnTip: mocks.spend }));
vi.mock("@/lib/compliance/request-geo", () => ({
  getRequestGeo: () => mocks.geo,
}));
vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdminClient: () => ({
    from: () => {
      const query = {
        select: () => query,
        eq: () => query,
        maybeSingle: async () => mocks.rows.shift(),
        insert: async () => ({ error: null }),
      };
      return query;
    },
  }),
}));

const creatorId = "22222222-2222-4222-8222-222222222222";
const postId = "33333333-3333-4333-8333-333333333333";
async function tip(extra: Record<string, unknown> = {}) {
  const { POST } = await import("@/app/api/tip/route");
  return POST(
    new NextRequest("https://getfansee.test/api/tip", {
      method: "POST",
      body: JSON.stringify({ creatorId, amountCents: 500, clientNonce: "retry-1", ...extra }),
    })
  );
}

beforeEach(() => {
  mocks.rows = [];
  mocks.geo = { country: "US", region: "CA" };
  mocks.spend.mockReset().mockResolvedValue({
    success: true,
    idempotent: false,
    tipId: "tip-1",
    creatorNetCents: 400,
    balanceAfterCents: 1500,
  });
});

describe("tip recipient integrity", () => {
  it("refuses money movement outside the payment launch region", async () => {
    mocks.geo = { country: "FR", region: "IDF" };
    expect((await tip()).status).toBe(403);
    expect(mocks.spend).not.toHaveBeenCalled();
  });
  it("does not debit a fan when the recipient is another fan", async () => {
    mocks.rows.push({ data: { role: "fan" }, error: null });
    expect((await tip()).status).toBe(404);
    expect(mocks.spend).not.toHaveBeenCalled();
  });

  it("does not debit a tip attributed to another creator's post", async () => {
    mocks.rows.push(
      { data: { role: "creator" }, error: null },
      { data: { creator_id: "another-creator" }, error: null }
    );
    expect((await tip({ postId })).status).toBe(400);
    expect(mocks.spend).not.toHaveBeenCalled();
  });

  it("fails closed when settings cannot be verified", async () => {
    mocks.rows.push(
      { data: { role: "creator" }, error: null },
      { data: null, error: { message: "database unavailable" } }
    );
    expect((await tip()).status).toBe(500);
    expect(mocks.spend).not.toHaveBeenCalled();
  });

  it("charges the authenticated fan for an eligible creator's own post", async () => {
    mocks.rows.push(
      { data: { role: "creator" }, error: null },
      { data: { creator_id: creatorId, review_status: "approved", deleted_at: null }, error: null },
      { data: { enabled: true }, error: null }
    );
    expect((await tip({ postId })).status).toBe(200);
    expect(mocks.spend).toHaveBeenCalledWith(
      expect.objectContaining({
        fanId: "11111111-1111-4111-8111-111111111111",
        creatorId,
        postId,
        amountCents: 500,
      })
    );
  });
});
