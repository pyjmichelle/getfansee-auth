/**
 * Creator tag management (Pre-Payment Alpha).
 *
 * GET /api/creator/tags — { allTags, myTagIds } (creator-category tags)
 * PUT /api/creator/tags — { tagIds: string[] } replace own creator_tags (max 5)
 *
 * Uses the user-scoped client; creator_tags RLS allows managing own rows.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireCreator } from "@/lib/authz";
import { jsonError } from "@/lib/http-errors";
import { getSupabaseRouteHandlerClient } from "@/lib/supabase-route";

const MAX_TAGS = 5;

export async function GET() {
  try {
    const { user } = await requireCreator();
    const supabase = await getSupabaseRouteHandlerClient();

    const [allResult, mineResult] = await Promise.all([
      supabase
        .from("tags")
        .select("id, name, slug")
        .eq("category", "creator")
        .order("name", { ascending: true }),
      supabase.from("creator_tags").select("tag_id").eq("creator_id", user.id),
    ]);

    return NextResponse.json({
      success: true,
      allTags: allResult.data ?? [],
      myTagIds: (mineResult.data ?? []).map((row) => row.tag_id),
    });
  } catch (err: unknown) {
    return jsonError(err);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { user } = await requireCreator();

    let body: { tagIds?: unknown };
    try {
      body = (await request.json()) as { tagIds?: unknown };
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
    }

    if (
      !Array.isArray(body.tagIds) ||
      body.tagIds.some((id) => typeof id !== "string" || id.length === 0)
    ) {
      return NextResponse.json(
        { success: false, error: "tagIds must be an array of tag ids" },
        { status: 400 }
      );
    }
    const tagIds = Array.from(new Set(body.tagIds as string[]));
    if (tagIds.length > MAX_TAGS) {
      return NextResponse.json(
        { success: false, error: `You can pick at most ${MAX_TAGS} tags` },
        { status: 400 }
      );
    }

    const supabase = await getSupabaseRouteHandlerClient();

    // Only creator-category tags are assignable.
    if (tagIds.length > 0) {
      const { data: validTags } = await supabase
        .from("tags")
        .select("id")
        .eq("category", "creator")
        .in("id", tagIds);
      if ((validTags ?? []).length !== tagIds.length) {
        return NextResponse.json(
          { success: false, error: "One or more tags are invalid" },
          { status: 400 }
        );
      }
    }

    // Replace own tag set.
    const { error: deleteError } = await supabase
      .from("creator_tags")
      .delete()
      .eq("creator_id", user.id);
    if (deleteError) {
      console.error("[creator/tags] delete error:", deleteError);
      return NextResponse.json({ success: false, error: "Failed to save tags" }, { status: 500 });
    }

    if (tagIds.length > 0) {
      const { error: insertError } = await supabase
        .from("creator_tags")
        .insert(tagIds.map((tag_id) => ({ creator_id: user.id, tag_id })));
      if (insertError) {
        console.error("[creator/tags] insert error:", insertError);
        return NextResponse.json({ success: false, error: "Failed to save tags" }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, tagIds });
  } catch (err: unknown) {
    return jsonError(err);
  }
}
