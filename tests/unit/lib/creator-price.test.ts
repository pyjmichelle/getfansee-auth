import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ dedicated: true, selects: [] as string[] }));
vi.mock("@/lib/supabase-universal", () => ({
  getSupabaseUniversalClient: async () => ({
    from: (table: string) => {
      const query = {
        select: (value: string) => {
          mocks.selects.push(value);
          return query;
        },
        eq: () => query,
        order: async () => ({ data: [], error: null }),
        maybeSingle: async () => ({
          data:
            table === "creators"
              ? mocks.dedicated
                ? { id: "creator-1", subscription_price_cents: 999 }
                : null
              : {
                  id: "creator-1",
                  subscription_price_cents: 2500,
                  is_verified: true,
                  created_at: "2026-01-01",
                },
          error: null,
        }),
        then: (resolve: (value: unknown) => unknown) => resolve({ data: [], error: null }),
      };
      return query;
    },
  }),
}));
import { getCreator } from "@/lib/creators";
beforeEach(() => {
  mocks.dedicated = true;
  mocks.selects = [];
});
describe("subscription price projection", () => {
  it("uses the authoritative profile price even when the dedicated record has a stale price", async () => {
    expect((await getCreator("creator-1"))?.subscription_price_cents).toBe(2500);
    expect(mocks.selects).toContain("is_verified, subscription_price_cents");
  });
  it("retains the price in the profiles fallback", async () => {
    mocks.dedicated = false;
    expect((await getCreator("creator-1"))?.subscription_price_cents).toBe(2500);
  });
});
