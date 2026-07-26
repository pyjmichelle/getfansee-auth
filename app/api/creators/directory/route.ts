/**
 * Public creator directory (Pre-Payment Alpha discovery).
 *
 * GET /api/creators/directory?category=&tags=slug1,slug2&sort=featured|newest|trending
 *
 * - Reads from the public-safe `public_creator_profiles` view (anon-readable).
 * - Tags come from anon-readable `tags` / `creator_tags`.
 * - Follower/post counts are aggregates only; follows RLS restricts row access
 *   to participants, so counts are computed with the admin client server-side.
 * - Gracefully degrades when migration 046 columns are not applied yet.
 */

import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/http-errors";
import { getSupabaseRouteHandlerClient } from "@/lib/supabase-route";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { isCreatorCategory } from "@/lib/constants/creator-categories";

const MAX_RESULTS = 60;

type Sort = "featured" | "newest" | "trending";

interface DirectoryCreator {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_verified: boolean;
  is_founding_creator: boolean;
  category: string | null;
  created_at: string | null;
  tags: { name: string; slug: string }[];
  follower_count: number;
  post_count: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryParam = searchParams.get("category") || "";
    const category = isCreatorCategory(categoryParam) ? categoryParam : null;
    const tagSlugs = (searchParams.get("tags") || "")
      .split(",")
      .map((slug) => slug.trim())
      .filter(Boolean)
      .slice(0, 10);
    const sortParam = searchParams.get("sort") || "featured";
    const sort: Sort = sortParam === "newest" || sortParam === "trending" ? sortParam : "featured";

    const supabase = await getSupabaseRouteHandlerClient();

    // Tags used to be applied by fetching a MAX_RESULTS*2 page of creators and
    // then `.filter()`-ing it in memory (see git history) — any creator whose
    // tag match fell outside that first capped page was silently invisible,
    // so a real but unpopular tag would deterministically render "no
    // creators" once the platform had more than ~120 creators. Resolving the
    // tag→creator_id set at the DB level FIRST (unbounded by MAX_RESULTS)
    // and filtering the main query with `.in("id", ...)` means the cap only
    // ever truncates the final page, never the tag match itself.
    let tagFilterCreatorIds: string[] | null = null;
    if (tagSlugs.length > 0) {
      const { data: tagMatchRows, error: tagMatchError } = await supabase
        .from("creator_tags")
        .select("creator_id, tags!inner(slug)")
        .in("tags.slug", tagSlugs);

      if (tagMatchError) {
        console.error("[creators/directory] tag match query error:", tagMatchError);
        return NextResponse.json(
          { success: false, error: "Failed to load creators" },
          { status: 500 }
        );
      }

      tagFilterCreatorIds = Array.from(
        new Set((tagMatchRows ?? []).map((row) => row.creator_id as string))
      );

      if (tagFilterCreatorIds.length === 0) {
        const { data: availableTags } = await supabase
          .from("tags")
          .select("name, slug")
          .eq("category", "creator")
          .order("name", { ascending: true });
        return NextResponse.json({
          success: true,
          creators: [],
          availableTags: availableTags ?? [],
        });
      }
    }

    // Try the full (post-046) projection first, fall back to the legacy view.
    let creators: Array<{
      id: string;
      display_name: string | null;
      avatar_url: string | null;
      bio: string | null;
      is_verified?: boolean | null;
      is_founding_creator?: boolean | null;
      category?: string | null;
      created_at?: string | null;
    }> = [];

    let query = supabase
      .from("public_creator_profiles")
      .select(
        "id, display_name, avatar_url, bio, is_verified, is_founding_creator, category, created_at"
      )
      .limit(MAX_RESULTS * 2);
    if (category) {
      query = query.eq("category", category);
    }
    if (tagFilterCreatorIds) {
      query = query.in("id", tagFilterCreatorIds);
    }
    const fullResult = await query;

    if (fullResult.error) {
      // Migration 046 not applied — legacy view without category columns.
      let legacyQuery = supabase
        .from("public_creator_profiles")
        .select("id, display_name, avatar_url, bio, is_verified")
        .limit(MAX_RESULTS * 2);
      if (tagFilterCreatorIds) {
        legacyQuery = legacyQuery.in("id", tagFilterCreatorIds);
      }
      const legacyResult = await legacyQuery;
      if (legacyResult.error) {
        console.error("[creators/directory] view query error:", legacyResult.error);
        return NextResponse.json(
          { success: false, error: "Failed to load creators" },
          { status: 500 }
        );
      }
      creators = legacyResult.data ?? [];
    } else {
      creators = fullResult.data ?? [];
    }

    if (creators.length === 0) {
      const { data: availableTags } = await supabase
        .from("tags")
        .select("name, slug")
        .eq("category", "creator")
        .order("name", { ascending: true });
      return NextResponse.json({ success: true, creators: [], availableTags: availableTags ?? [] });
    }

    const creatorIds = creators.map((row) => row.id);

    // Tags (anon-readable) + aggregate counts (admin, aggregates only).
    const admin = getSupabaseAdminClient();
    const [tagRowsResult, allTagsResult, countsRpcResult] = await Promise.all([
      supabase
        .from("creator_tags")
        .select("creator_id, tags(name, slug)")
        .in("creator_id", creatorIds),
      supabase
        .from("tags")
        .select("name, slug")
        .eq("category", "creator")
        .order("name", { ascending: true }),
      admin.rpc("get_creator_directory_counts", { p_creator_ids: creatorIds }),
    ]);

    const tagsByCreator = new Map<string, { name: string; slug: string }[]>();
    for (const row of tagRowsResult.data ?? []) {
      const tag = Array.isArray(row.tags) ? row.tags[0] : row.tags;
      if (!tag) continue;
      const list = tagsByCreator.get(row.creator_id) ?? [];
      list.push({ name: tag.name, slug: tag.slug });
      tagsByCreator.set(row.creator_id, list);
    }

    const followerCounts = new Map<string, number>();
    const postCounts = new Map<string, number>();
    if (countsRpcResult.error) {
      // Migration 049 not applied yet — degrade to the old in-memory count,
      // still capped by the fact that creatorIds itself is bounded to
      // MAX_RESULTS*2 rows (unlike the un-capped follow/post pull this
      // replaces, this fallback path is only hit until the migration lands).
      console.warn(
        "[creators/directory] get_creator_directory_counts RPC failed (migration 049?):",
        countsRpcResult.error.message
      );
      // PostgREST applies a default row cap (~1000) per request regardless of
      // the `in(creator_id, ...)` filter width — a single popular creator can
      // exceed that on its own, so this must page through results rather
      // than trust one unranged select() to return everything.
      const countAllRows = async (table: "follows" | "posts") => {
        const counts = new Map<string, number>();
        const PAGE_SIZE = 1000;
        const MAX_ROWS = 50_000;
        for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
          const { data, error } = await admin
            .from(table)
            .select("creator_id")
            .in("creator_id", creatorIds)
            .range(from, from + PAGE_SIZE - 1);
          if (error) {
            console.warn(`[creators/directory] ${table} count fallback page error:`, error.message);
            break;
          }
          for (const row of data ?? []) {
            counts.set(row.creator_id, (counts.get(row.creator_id) ?? 0) + 1);
          }
          if (!data || data.length < PAGE_SIZE) break;
        }
        return counts;
      };
      const [followCountsFallback, postCountsFallback] = await Promise.all([
        countAllRows("follows"),
        countAllRows("posts"),
      ]);
      for (const [id, n] of followCountsFallback) followerCounts.set(id, n);
      for (const [id, n] of postCountsFallback) postCounts.set(id, n);
    } else {
      for (const row of countsRpcResult.data ?? []) {
        followerCounts.set(row.creator_id, row.follower_count ?? 0);
        postCounts.set(row.creator_id, row.post_count ?? 0);
      }
    }

    const results: DirectoryCreator[] = creators.map((row) => ({
      id: row.id,
      display_name: row.display_name ?? null,
      avatar_url: row.avatar_url ?? null,
      bio: row.bio ?? null,
      is_verified: !!row.is_verified,
      is_founding_creator: !!row.is_founding_creator,
      category: row.category ?? null,
      created_at: row.created_at ?? null,
      tags: tagsByCreator.get(row.id) ?? [],
      follower_count: followerCounts.get(row.id) ?? 0,
      post_count: postCounts.get(row.id) ?? 0,
    }));

    // tagFilterCreatorIds already scoped `creators` to matching rows via the
    // DB query above — no further in-memory tag filtering needed here.

    results.sort((a, b) => {
      if (sort === "newest") {
        return (b.created_at ?? "").localeCompare(a.created_at ?? "");
      }
      if (sort === "trending") {
        return b.follower_count - a.follower_count || b.post_count - a.post_count;
      }
      // featured: founding creators first, then most followed, then most posts.
      return (
        Number(b.is_founding_creator) - Number(a.is_founding_creator) ||
        b.follower_count - a.follower_count ||
        b.post_count - a.post_count
      );
    });

    return NextResponse.json({
      success: true,
      creators: results.slice(0, MAX_RESULTS),
      availableTags: allTagsResult.data ?? [],
    });
  } catch (err: unknown) {
    return jsonError(err);
  }
}
