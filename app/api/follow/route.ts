/**
 * Free follow (Pre-Payment Alpha) — distinct from paid subscriptions.
 *
 * GET    /api/follow?creatorId=... — { following, count } (works for guests: following=false)
 * GET    /api/follow (no creatorId) — { followingIds: string[] } for the current user
 *        (used to hydrate feed/list views without one request per creator)
 * POST   /api/follow  { creatorId } — follow
 * DELETE /api/follow?creatorId=...  — unfollow
 *
 * Follower counts are public, but RLS restricts follows SELECT to the
 * participants — so the count is computed with the admin client (no PII
 * leaves the server; only an aggregate number is returned).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { jsonError } from "@/lib/http-errors";
import { getCurrentUser } from "@/lib/auth-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { checkRateLimit, rateLimitHeaders } from "@/lib/rate-limit";

const WRITE_LIMIT = 60;
const WRITE_WINDOW_MS = 60_000;

export async function GET(request: NextRequest) {
  try {
    const creatorId = new URL(request.url).searchParams.get("creatorId");

    if (!creatorId) {
      // Bulk mode: list every creator the current user follows.
      const user = await getCurrentUser();
      if (!user) {
        return NextResponse.json({ success: true, followingIds: [] });
      }
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase
        .from("follows")
        .select("creator_id")
        .eq("follower_id", user.id)
        .limit(2000);
      if (error) {
        console.error("[follow] list error:", error);
        return NextResponse.json({ success: true, followingIds: [] });
      }
      return NextResponse.json({
        success: true,
        followingIds: (data ?? []).map((row) => row.creator_id),
      });
    }

    const user = await getCurrentUser();
    const supabase = getSupabaseAdminClient();

    const [{ count }, followingResult] = await Promise.all([
      supabase
        .from("follows")
        .select("creator_id", { count: "exact", head: true })
        .eq("creator_id", creatorId),
      user
        ? supabase
            .from("follows")
            .select("creator_id")
            .eq("creator_id", creatorId)
            .eq("follower_id", user.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    return NextResponse.json({
      success: true,
      count: count ?? 0,
      following: !!followingResult.data,
    });
  } catch (err: unknown) {
    return jsonError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireUser();

    const rateLimit = checkRateLimit(`follow-write:${user.id}`, WRITE_LIMIT, WRITE_WINDOW_MS);
    if (!rateLimit.success) {
      return NextResponse.json(
        { success: false, error: "Too many requests" },
        { status: 429, headers: rateLimitHeaders(rateLimit) }
      );
    }

    let body: { creatorId?: string };
    try {
      body = (await request.json()) as { creatorId?: string };
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const creatorId = body.creatorId;
    if (!creatorId) {
      return NextResponse.json({ success: false, error: "Missing creatorId" }, { status: 400 });
    }
    if (creatorId === user.id) {
      return NextResponse.json(
        { success: false, error: "You cannot follow yourself" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdminClient();

    // Target must be an active creator.
    const { data: creator } = await supabase
      .from("profiles")
      .select("id, role, is_banned")
      .eq("id", creatorId)
      .maybeSingle();

    if (!creator || creator.role !== "creator" || creator.is_banned) {
      return NextResponse.json({ success: false, error: "Creator not found" }, { status: 404 });
    }

    const { error } = await supabase
      .from("follows")
      .upsert(
        { follower_id: user.id, creator_id: creatorId },
        { onConflict: "follower_id,creator_id", ignoreDuplicates: true }
      );

    if (error) {
      console.error("[follow] insert error:", error);
      return NextResponse.json({ success: false, error: "Failed to follow" }, { status: 500 });
    }

    return NextResponse.json({ success: true, following: true });
  } catch (err: unknown) {
    return jsonError(err);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { user } = await requireUser();

    const rateLimit = checkRateLimit(`follow-write:${user.id}`, WRITE_LIMIT, WRITE_WINDOW_MS);
    if (!rateLimit.success) {
      return NextResponse.json(
        { success: false, error: "Too many requests" },
        { status: 429, headers: rateLimitHeaders(rateLimit) }
      );
    }

    const creatorId = new URL(request.url).searchParams.get("creatorId");
    if (!creatorId) {
      return NextResponse.json({ success: false, error: "Missing creatorId" }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const { error } = await supabase
      .from("follows")
      .delete()
      .eq("follower_id", user.id)
      .eq("creator_id", creatorId);

    if (error) {
      console.error("[follow] delete error:", error);
      return NextResponse.json({ success: false, error: "Failed to unfollow" }, { status: 500 });
    }

    return NextResponse.json({ success: true, following: false });
  } catch (err: unknown) {
    return jsonError(err);
  }
}
