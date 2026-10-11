import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({
  role: "creator",
  error: null as unknown,
  selects: [] as string[],
}));
vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdminClient: () => ({
    from: (table: string) => {
      let selection = "";
      const result = () => {
        if (table === "profiles" && selection.startsWith("role"))
          return {
            data: { role: mocks.role, commission_free_until: "2099-01-01" },
            error: mocks.error,
          };
        if (table === "creator_tip_settings")
          return {
            data: { enabled: true, show_supporters: true, goal_enabled: false },
            error: null,
          };
        if (table === "tips")
          return {
            data: [
              {
                fan_id: "fan-1",
                amount_cents: 500,
                message: "private message",
                created_at: "2026-01-01",
              },
            ],
            error: null,
          };
        return { data: [{ id: "fan-1", display_name: "Fan" }], error: null };
      };
      const query = {
        select: (value: string) => {
          selection = value;
          mocks.selects.push(value);
          return query;
        },
        eq: () => query,
        in: () => query,
        order: () => query,
        limit: () => query,
        maybeSingle: async () => result(),
        then: (resolve: (value: unknown) => unknown) => resolve(result()),
      };
      return query;
    },
  }),
}));
import { GET } from "@/app/api/creator/[id]/tip-settings/route";
const request = () =>
  GET(new NextRequest("http://localhost/api/creator/tip-settings"), {
    params: Promise.resolve({ id: "11111111-1111-1111-1111-111111111111" }),
  });
beforeEach(() => {
  mocks.role = "creator";
  mocks.error = null;
  mocks.selects = [];
});
describe("public tip panel", () => {
  it("never exposes creator-private messages and resolves the creator's fee window", async () => {
    const response = await request();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.fee_bps).toBe(0);
    expect(body.supporters[0].message).toBeNull();
    expect(JSON.stringify(body)).not.toContain("private message");
    expect(mocks.selects).toContain("fan_id, amount_cents, created_at");
  });
  it("refuses a noncreator recipient", async () => {
    mocks.role = "fan";
    expect((await request()).status).toBe(404);
  });
  it("fails closed when the creator profile cannot be checked", async () => {
    mocks.error = { message: "unavailable" };
    expect((await request()).status).toBe(503);
  });
});
