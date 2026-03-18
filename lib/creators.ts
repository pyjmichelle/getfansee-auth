/**
 * Creators 数据访问层
 * Money & Access MVP
 */

import { getSupabaseUniversalClient } from "./supabase-universal";

export type Creator = {
  id: string;
  display_name: string;
  avatar_url?: string;
  bio?: string;
  created_at: string;
};

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
      return data;
    }

    if (error) {
      console.warn("[creators] getCreator creators-table error, falling back to profiles:", error);
    }

    // Fallback: query profiles for any user with role='creator'
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url, bio, created_at, subscription_price_cents")
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

    return {
      id: profile.id,
      display_name: profile.display_name ?? "",
      avatar_url: profile.avatar_url ?? undefined,
      bio: profile.bio ?? undefined,
      created_at: profile.created_at,
    } satisfies Creator;
  } catch (err) {
    console.error("[creators] getCreator exception:", err);
    return null;
  }
}
