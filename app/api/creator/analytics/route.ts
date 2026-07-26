/**
 * Creator studio analytics (Pre-Payment Alpha — real data).
 *
 * GET /api/creator/analytics?range=7d|30d|90d
 *
 * Returns Alpha-relevant metrics for the signed-in creator:
 * - profile views (total + daily series, from creator_daily_stats)
 * - followers (total + new in range + daily series)
 * - saves (saved_creators count)
 * - external link clicks (sum of own approved links' click_count)
 * - top posts by likes
 *
 * Uses the admin client: RLS lets creators see own followers/links, but
 * saved_creators is only readable by the saver — aggregates are computed
 * server-side and only numbers are returned (requireCreator-gated).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireCreator } from "@/lib/authz";
import { jsonError } from "@/lib/http-errors";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const RANGE_DAYS: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireCreator();
    const creatorId = user.id;

    const { searchParams } = new URL(request.url);
    const days = RANGE_DAYS[searchParams.get("range") || "30d"] ?? 30;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const startDay = startDate.toISOString().split("T")[0];

    const supabase = getSupabaseAdminClient();

    const [
      viewsResult,
      followersTotalResult,
      newFollowsResult,
      savesResult,
      linksResult,
      postsResult,
    ] = await Promise.all([
      supabase
        .from("creator_daily_stats")
        .select("day, profile_views")
        .eq("creator_id", creatorId)
        .gte("day", startDay)
        .order("day", { ascending: true }),
      // All-time follower count: a head-only count, not a row download —
      // was previously computed as `.select("created_at")` with no range or
      // limit, pulling a creator's entire follow history just to take its
      // `.length` (see 2026-07-26 UI/performance audit).
      supabase
        .from("follows")
        .select("creator_id", { count: "exact", head: true })
        .eq("creator_id", creatorId),
      // New-in-range rows only (bounded by the selected 7/30/90d window,
      // not the creator's whole lifetime) — needed for the daily series.
      supabase
        .from("follows")
        .select("created_at")
        .eq("creator_id", creatorId)
        .gte("created_at", startDate.toISOString()),
      supabase
        .from("saved_creators")
        .select("creator_id", { count: "exact", head: true })
        .eq("creator_id", creatorId),
      supabase
        .from("creator_external_links")
        .select("click_count")
        .eq("creator_id", creatorId)
        .eq("status", "approved"),
      supabase
        .from("posts")
        .select("id, title, content, likes_count, visibility, price_cents, post_media(media_url)")
        .eq("creator_id", creatorId)
        .order("likes_count", { ascending: false })
        .limit(5),
    ]);

    // Daily views series covering every day in range (zero-filled).
    const viewsByDay = new Map<string, number>();
    for (const row of viewsResult.data ?? []) {
      viewsByDay.set(row.day, row.profile_views ?? 0);
    }
    const viewsSeries: { day: string; views: number }[] = [];
    for (let i = 0; i < days; i++) {
      const day = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      viewsSeries.push({ day, views: viewsByDay.get(day) ?? 0 });
    }
    const totalViews = viewsSeries.reduce((sum, point) => sum + point.views, 0);

    // Followers: total (head count) + new within range + daily series.
    const followersTotal = followersTotalResult.count ?? 0;
    const newFollowRows = newFollowsResult.data ?? [];
    const followsByDay = new Map<string, number>();
    let newFollowers = 0;
    for (const row of newFollowRows) {
      if (!row.created_at) continue;
      const day = row.created_at.split("T")[0];
      newFollowers += 1;
      followsByDay.set(day, (followsByDay.get(day) ?? 0) + 1);
    }
    const followersSeries: { day: string; follows: number }[] = [];
    for (let i = 0; i < days; i++) {
      const day = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      followersSeries.push({ day, follows: followsByDay.get(day) ?? 0 });
    }

    const linkClicks = (linksResult.data ?? []).reduce(
      (sum, row) => sum + (row.click_count ?? 0),
      0
    );

    const topPosts = (postsResult.data ?? []).map((post) => {
      const media = Array.isArray(post.post_media) ? post.post_media[0] : post.post_media;
      return {
        id: post.id,
        title: post.title || (post.content ? `${post.content.slice(0, 50)}…` : "Untitled post"),
        likes: post.likes_count ?? 0,
        visibility: post.visibility,
        price_cents: post.price_cents ?? 0,
        thumbnail: media?.media_url ?? null,
      };
    });

    return NextResponse.json({
      success: true,
      analytics: {
        profileViews: { total: totalViews, series: viewsSeries },
        followers: { total: followersTotal, new: newFollowers, series: followersSeries },
        saves: savesResult.count ?? 0,
        linkClicks,
        topPosts,
      },
    });
  } catch (err: unknown) {
    return jsonError(err);
  }
}
