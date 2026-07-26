/**
 * Saved creators (bookmarks) — Pre-Payment Alpha.
 *
 * GET    /api/save/creator               — list own saved creators (with public profile info)
 * GET    /api/save/creator?creatorId=... — { saved } for one creator
 * POST   /api/save/creator { creatorId } — save
 * DELETE /api/save/creator?creatorId=... — unsave
 *
 * Uses the user-scoped client; saved_creators RLS is own-rows-only.
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
    const creatorId = new URL(request.url).searchParams.get("creatorId");

    if (creatorId) {
      const { data } = await supabase
        .from("saved_creators")
        .select("creator_id")
        .eq("user_id", user.id)
        .eq("creator_id", creatorId)
        .maybeSingle();
      return NextResponse.json({ success: true, saved: !!data });
    }

    const { data: saved, error } = await supabase
      .from("saved_creators")
      .select("creator_id, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      console.error("[save/creator] list error:", error);
      return NextResponse.json({ success: false, error: "Failed to load" }, { status: 500 });
    }

    const ids = (saved ?? []).map((row) => row.creator_id);
    let creators: unknown[] = [];
    if (ids.length > 0) {
      const { data: profiles } = await supabase
        .from("public_creator_profiles")
        .select("id, display_name, avatar_url, bio, is_verified, is_founding_creator, category")
        .in("id", ids);
      // Preserve saved order
      const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
      creators = ids.map((id) => byId.get(id)).filter(Boolean);
    }

    return NextResponse.json({ success: true, creators });
  } catch (err: unknown) {
    return jsonError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireUser();

    const rateLimit = checkRateLimit(`save-creator:${user.id}`, WRITE_LIMIT, WRITE_WINDOW_MS);
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

    if (!body.creatorId) {
      return NextResponse.json({ success: false, error: "Missing creatorId" }, { status: 400 });
    }

    const supabase = await getSupabaseRouteHandlerClient();
    const { error } = await supabase
      .from("saved_creators")
      .upsert(
        { user_id: user.id, creator_id: body.creatorId },
        { onConflict: "user_id,creator_id", ignoreDuplicates: true }
      );

    if (error) {
      console.error("[save/creator] insert error:", error);
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

    const rateLimit = checkRateLimit(`save-creator:${user.id}`, WRITE_LIMIT, WRITE_WINDOW_MS);
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

    const supabase = await getSupabaseRouteHandlerClient();
    const { error } = await supabase
      .from("saved_creators")
      .delete()
      .eq("user_id", user.id)
      .eq("creator_id", creatorId);

    if (error) {
      console.error("[save/creator] delete error:", error);
      return NextResponse.json({ success: false, error: "Failed to unsave" }, { status: 500 });
    }

    return NextResponse.json({ success: true, saved: false });
  } catch (err: unknown) {
    return jsonError(err);
  }
}
