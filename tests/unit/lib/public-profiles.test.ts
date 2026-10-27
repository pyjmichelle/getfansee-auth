import { describe, expect, it, vi } from "vitest";
import { getPublicCreatorLabels } from "@/lib/public-profiles";
import type { SupabaseClient } from "@supabase/supabase-js";

function fixture(data: unknown[], error: unknown = null) {
  const ids = vi.fn().mockResolvedValue({ data, error });
  const select = vi.fn().mockReturnValue({ in: ids });
  const from = vi.fn().mockReturnValue({ select });
  return { client: { from } as unknown as Pick<SupabaseClient, "from">, from, select, ids };
}
describe("public creator label enrichment", () => {
  it("preserves author labels through the safe view when raw rows are private", async () => {
    const f = fixture([{ id: "creator-1", display_name: "Creator", avatar_url: null }]);
    const result = await getPublicCreatorLabels(f.client, ["creator-1", "creator-1"]);
    expect(result.get("creator-1")?.display_name).toBe("Creator");
    expect(f.from).toHaveBeenCalledWith("public_creator_profiles");
    expect(f.select).toHaveBeenCalledWith("id, display_name, avatar_url");
    expect(f.ids).toHaveBeenCalledWith("id", ["creator-1"]);
  });
  it("fails closed rather than issuing a private-table fallback", async () => {
    const f = fixture([], { message: "unavailable" });
    await expect(getPublicCreatorLabels(f.client, ["creator-1"])).rejects.toThrow(
      "Creator profiles unavailable"
    );
    expect(f.from).toHaveBeenCalledTimes(1);
  });
  it("does not query a creator directory for an empty result", async () => {
    const f = fixture([]);
    expect((await getPublicCreatorLabels(f.client, [])).size).toBe(0);
    expect(f.from).not.toHaveBeenCalled();
  });
});
