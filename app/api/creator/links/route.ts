/**
 * Creator external links management (Pre-Payment Alpha).
 *
 * GET    /api/creator/links        — list own links (all statuses)
 * POST   /api/creator/links        — submit a new link (lands as pending review)
 * DELETE /api/creator/links?id=... — remove own link
 *
 * Auth: signed-in creator. RLS on creator_external_links already restricts
 * rows to the owner; we use the user-scoped route handler client here.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireCreator } from "@/lib/authz";
import { jsonError } from "@/lib/http-errors";
import { getSupabaseRouteHandlerClient } from "@/lib/supabase-route";
import { MAX_LINKS_PER_CREATOR, validateExternalLinkInput } from "@/lib/external-links";

export async function GET() {
  try {
    const { user } = await requireCreator();
    const supabase = await getSupabaseRouteHandlerClient();

    const { data, error } = await supabase
      .from("creator_external_links")
      .select("id, url, label, status, click_count, rejection_reason, created_at")
      .eq("creator_id", user.id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[creator/links] list error:", error);
      return NextResponse.json({ success: false, error: "Failed to load links" }, { status: 500 });
    }

    return NextResponse.json({ success: true, links: data ?? [] });
  } catch (err: unknown) {
    return jsonError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireCreator();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const result = validateExternalLinkInput(body);
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    const supabase = await getSupabaseRouteHandlerClient();

    const { count } = await supabase
      .from("creator_external_links")
      .select("id", { count: "exact", head: true })
      .eq("creator_id", user.id);

    if ((count ?? 0) >= MAX_LINKS_PER_CREATOR) {
      return NextResponse.json(
        { success: false, error: `You can have at most ${MAX_LINKS_PER_CREATOR} links` },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("creator_external_links")
      .insert({
        creator_id: user.id,
        url: result.value.url,
        label: result.value.label,
        status: "pending",
      })
      .select("id, url, label, status, click_count, created_at")
      .single();

    if (error) {
      console.error("[creator/links] insert error:", error);
      return NextResponse.json({ success: false, error: "Failed to submit link" }, { status: 500 });
    }

    return NextResponse.json({ success: true, link: data });
  } catch (err: unknown) {
    return jsonError(err);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { user } = await requireCreator();

    const id = new URL(request.url).searchParams.get("id");
    if (!id) {
      return NextResponse.json({ success: false, error: "Missing link id" }, { status: 400 });
    }

    const supabase = await getSupabaseRouteHandlerClient();
    const { error } = await supabase
      .from("creator_external_links")
      .delete()
      .eq("id", id)
      .eq("creator_id", user.id);

    if (error) {
      console.error("[creator/links] delete error:", error);
      return NextResponse.json({ success: false, error: "Failed to delete link" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return jsonError(err);
  }
}
