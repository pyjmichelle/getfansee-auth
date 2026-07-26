/**
 * Creators 数据访问层
 * Money & Access MVP
 */

import { getSupabaseUniversalClient } from "./supabase-universal";
import type { PublicExternalLink } from "./external-links";

export type Creator = {
  id: string;
  display_name: string;
  avatar_url?: string;
  bio?: string;
  created_at: string;
  is_verified?: boolean;
  is_founding_creator?: boolean;
  category?: string | null;
  subscription_price_cents?: number | null;
  subscribers_count?: number | null;
  subscriber_count?: number | null;
  external_links?: PublicExternalLink[];
  tags?: string[];
};

/**
 * Approved external links, creator tags and Alpha profile fields.
 * Tolerant of databases where migration 046 has not been applied yet:
 * every query failure degrades to empty/false values instead of breaking
 * the whole profile load.
 */
async function getCreatorPublicExtras(creatorId: string): Promise<{
  external_links: PublicExternalLink[];
  tags: string[];
  is_founding_creator: boolean;
  category: string | null;
}> {
  const supabase = await getSupabaseUniversalClient();

  const [linksResult, tagsResult, alphaFieldsResult] = await Promise.all([
    supabase
      .from("creator_external_links")
      .select("id, url, label")
      .eq("creator_id", creatorId)
      .eq("status", "approved")
      .order("created_at", { ascending: true }),
    supabase.from("creator_tags").select("tags(name)").eq("creator_id", creatorId),
    supabase
      .from("profiles")
      .select("is_founding_creator, category")
      .eq("id", creatorId)
      .maybeSingle(),
  ]);

  const external_links = (linksResult.data ?? []) as PublicExternalLink[];
  const tags = (tagsResult.data ?? [])
    .map((row) => {
      const tag = (row as { tags: { name: string } | { name: string }[] | null }).tags;
      if (!tag) return null;
      return Array.isArray(tag) ? tag[0]?.name : tag.name;
    })
    .filter((name): name is string => typeof name === "string");

  const alphaFields = alphaFieldsResult.data as {
    is_founding_creator?: boolean;
    category?: string | null;
  } | null;

  return {
    external_links,
    tags,
    is_founding_creator: alphaFields?.is_founding_creator ?? false,
    category: alphaFields?.category ?? null,
  };
}

/**
 * 获取所有 creators 列表
 * @returns Creator[] 或 null（如果查询失败）
 */
export async function listCreators(): Promise<Creator[] | null> {
  try {
    const supabase = await getSupabaseUniversalClient();
    const { data, error } = await supabase
      .from("creators")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[creators] listCreators error:", error);
      return null;
    }

    return data || [];
  } catch (err) {
    console.error("[creators] listCreators exception:", err);
    return null;
  }
}

/**
 * 获取单个 creator
 * 先查 creators 表，找不到时回退到 profiles（role='creator'）
 * @param creatorId Creator ID
 * @returns Creator 或 null（如果查询失败）
 */
export async function getCreator(creatorId: string): Promise<Creator | null> {
  try {
    const supabase = await getSupabaseUniversalClient();

    // Primary: query dedicated creators table
    const { data, error } = await supabase
      .from("creators")
      .select("*")
      .eq("id", creatorId)
      .maybeSingle();

    if (!error && data) {
      // creators table doesn't carry public badge/category fields — fetch from profiles
      const [{ data: pv }, extras] = await Promise.all([
        supabase.from("profiles").select("is_verified").eq("id", creatorId).maybeSingle(),
        getCreatorPublicExtras(creatorId),
      ]);
      return {
        ...data,
        is_verified: pv?.is_verified ?? false,
        is_founding_creator: extras.is_founding_creator,
        category: extras.category,
        external_links: extras.external_links,
        tags: extras.tags,
      };
    }

    if (error) {
      console.warn("[creators] getCreator creators-table error, falling back to profiles:", error);
    }

    // Fallback: query profiles for any user with role='creator'
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select(
        "id, display_name, avatar_url, bio, created_at, subscription_price_cents, is_verified"
      )
      .eq("id", creatorId)
      .eq("role", "creator")
      .maybeSingle();

    if (profileError) {
      console.error("[creators] getCreator profile fallback error:", profileError);
      return null;
    }

    if (!profile) {
      return null;
    }

    const extras = await getCreatorPublicExtras(creatorId);

    return {
      id: profile.id,
      display_name: profile.display_name ?? "",
      avatar_url: profile.avatar_url ?? undefined,
      bio: profile.bio ?? undefined,
      created_at: profile.created_at,
      is_verified: profile.is_verified ?? false,
      is_founding_creator: extras.is_founding_creator,
      category: extras.category,
      external_links: extras.external_links,
      tags: extras.tags,
    } satisfies Creator;
  } catch (err) {
    console.error("[creators] getCreator exception:", err);
    return null;
  }
}
