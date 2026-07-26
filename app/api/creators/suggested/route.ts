/**
 * Lightweight "suggested creators" endpoint for the Home sidebar.
 *
 * GET /api/creators/suggested?limit=4
 *
 * The Home feed only ever renders 3-4 suggested creators, but it was
 * previously calling the full `/api/creators/directory?sort=trending`
 * endpoint (see 2026-07-26 UI/performance audit) — that route pages up to
 * MAX_RESULTS*2 (120) creators, resolves tags for all of them, and computes
 * follower/post aggregate counts for all of them, just so Home could take
 * the first 3-4. This route does the minimum: pull a small candidate pool
 * (id/display_name/avatar_url only, no tags), rank by follower count via
 * the same DB-side aggregate RPC as the directory route, and return only
 * the requested number of rows.
 */

import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/http-errors";
import { getSupabaseRouteHandlerClient } from "@/lib/supabase-route";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const MAX_LIMIT = 8;
const CANDIDATE_POOL_SIZE = 20;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedLimit = Number(searchParams.get("limit") ?? 4);
    const limit =
      Number.isFinite(requestedLimit) && requestedLimit > 0
        ? Math.min(Math.floor(requestedLimit), MAX_LIMIT)
        : 4;

    const supabase = await getSupabaseRouteHandlerClient();

    const { data: candidates, error } = await supabase
      .from("public_creator_profiles")
      .select("id, display_name, avatar_url")
      .order("created_at", { ascending: false })
      .limit(CANDIDATE_POOL_SIZE);

    if (error) {
      console.error("[creators/suggested] query error:", error);
      return NextResponse.json(
        { success: false, error: "Failed to load creators" },
        { status: 500 }
      );
    }

    const pool = candidates ?? [];
    if (pool.length === 0) {
      return NextResponse.json({ success: true, creators: [] });
    }

    const admin = getSupabaseAdminClient();
    const { data: counts, error: countsError } = await admin.rpc("get_creator_directory_counts", {
      p_creator_ids: pool.map((row) => row.id),
    });

    const followerCounts = new Map<string, number>();
    if (countsError) {
      // Migration 049 not applied yet — fall back to insertion order (already
      // "newest first", a reasonable degrade for a sidebar suggestion widget).
      console.warn(
        "[creators/suggested] get_creator_directory_counts RPC failed (migration 049?):",
        countsError.message
      );
    } else {
      for (const row of counts ?? []) {
        followerCounts.set(row.creator_id, row.follower_count ?? 0);
      }
    }

    const ranked = [...pool].sort(
      (a, b) => (followerCounts.get(b.id) ?? 0) - (followerCounts.get(a.id) ?? 0)
    );

    return NextResponse.json({
      success: true,
      creators: ranked.slice(0, limit).map((row) => ({
        id: row.id,
        display_name: row.display_name ?? null,
        avatar_url: row.avatar_url ?? null,
      })),
    });
  } catch (err: unknown) {
    return jsonError(err);
  }
}
