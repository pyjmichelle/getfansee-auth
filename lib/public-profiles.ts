import type { SupabaseClient } from "@supabase/supabase-js";

export type PublicCreatorLabel = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
};

/** Enrich content without opening private profile rows to other users. */
export async function getPublicCreatorLabels(
  client: Pick<SupabaseClient, "from">,
  ids: string[]
): Promise<Map<string, PublicCreatorLabel>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await client
    .from("public_creator_profiles")
    .select("id, display_name, avatar_url")
    .in("id", [...new Set(ids)]);
  if (error) throw new Error("Creator profiles unavailable");
  return new Map((data ?? []).map((row) => [row.id, row as PublicCreatorLabel]));
}
