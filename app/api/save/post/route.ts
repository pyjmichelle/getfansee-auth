/**
 * Saved posts (bookmarks) — Pre-Payment Alpha.
 *
 * GET    /api/save/post              — list own saved post ids
 * GET    /api/save/post?postId=...   — { saved } for one post
 * POST   /api/save/post { postId }   — save
 * DELETE /api/save/post?postId=...   — unsave
 *
 * Uses the user-scoped client; saved_posts RLS is own-rows-only
 * (delete policy added in migration 046).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { jsonError } from "@/lib/http-errors";
import { getSupabaseRouteHandlerClient } from "@/lib/supabase-route";
import { checkRateLimit, rateLimitHeaders } from "@/lib/rate-limit";

const WRITE_LIMIT = 60;
const WRITE_WINDOW_MS = 60_000;

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireUser();
    const supabase = await getSupabaseRouteHandlerClient();
    const postId = new URL(request.url).searchParams.get("postId");

    if (postId) {
      const { data } = await supabase
        .from("saved_posts")
        .select("post_id")
        .eq("fan_id", user.id)
        .eq("post_id", postId)
        .maybeSingle();
      return NextResponse.json({ success: true, saved: !!data });
    }

    const { data, error } = await supabase
      .from("saved_posts")
      .select("post_id, created_at")
      .eq("fan_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1000);

    if (error) {
      console.error("[save/post] list error:", error);
      return NextResponse.json({ success: false, error: "Failed to load" }, { status: 500 });
    }

    return NextResponse.json({ success: true, postIds: (data ?? []).map((r) => r.post_id) });
  } catch (err: unknown) {
    return jsonError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireUser();

    const rateLimit = checkRateLimit(`save-post:${user.id}`, WRITE_LIMIT, WRITE_WINDOW_MS);
    if (!rateLimit.success) {
      return NextResponse.json(
        { success: false, error: "Too many requests" },
        { status: 429, headers: rateLimitHeaders(rateLimit) }
      );
    }

    let body: { postId?: string };
    try {
      body = (await request.json()) as { postId?: string };
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
    }

    if (!body.postId) {
      return NextResponse.json({ success: false, error: "Missing postId" }, { status: 400 });
    }

    const supabase = await getSupabaseRouteHandlerClient();
    const { error } = await supabase
      .from("saved_posts")
      .upsert(
        { fan_id: user.id, post_id: body.postId },
        { onConflict: "fan_id,post_id", ignoreDuplicates: true }
      );

    if (error) {
      console.error("[save/post] insert error:", error);
      return NextResponse.json({ success: false, error: "Failed to save" }, { status: 500 });
    }

    return NextResponse.json({ success: true, saved: true });
  } catch (err: unknown) {
    return jsonError(err);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { user } = await requireUser();

    const rateLimit = checkRateLimit(`save-post:${user.id}`, WRITE_LIMIT, WRITE_WINDOW_MS);
    if (!rateLimit.success) {
      return NextResponse.json(
        { success: false, error: "Too many requests" },
        { status: 429, headers: rateLimitHeaders(rateLimit) }
      );
    }

    const postId = new URL(request.url).searchParams.get("postId");
    if (!postId) {
      return NextResponse.json({ success: false, error: "Missing postId" }, { status: 400 });
    }

    const supabase = await getSupabaseRouteHandlerClient();
    const { error } = await supabase
      .from("saved_posts")
      .delete()
      .eq("fan_id", user.id)
      .eq("post_id", postId);

    if (error) {
      console.error("[save/post] delete error:", error);
      return NextResponse.json({ success: false, error: "Failed to unsave" }, { status: 500 });
    }

    return NextResponse.json({ success: true, saved: false });
  } catch (err: unknown) {
    return jsonError(err);
  }
}
