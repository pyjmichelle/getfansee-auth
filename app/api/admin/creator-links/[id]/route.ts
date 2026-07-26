/**
 * POST /api/admin/creator-links/[id]
 *
 * Approve or reject a creator external link.
 * Auth: requireAdmin()
 *
 * Body: { action: "approve" | "reject", reason?: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { jsonError } from "@/lib/http-errors";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { isAllowedExternalLinkDomain } from "@/lib/external-links";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { user } = await requireAdmin();
    const { id } = await params;

    let body: { action?: string; reason?: string };
    try {
      body = (await request.json()) as { action?: string; reason?: string };
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
    }

    if (body.action !== "approve" && body.action !== "reject") {
      return NextResponse.json(
        { success: false, error: "action must be 'approve' or 'reject'" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdminClient();

    const { data: link } = await supabase
      .from("creator_external_links")
      .select("id, url, status")
      .eq("id", id)
      .maybeSingle();

    if (!link) {
      return NextResponse.json({ success: false, error: "Link not found" }, { status: 404 });
    }

    // Defense in depth: even an admin approval must respect the domain allowlist.
    if (body.action === "approve" && !isAllowedExternalLinkDomain(link.url)) {
      return NextResponse.json(
        { success: false, error: "Domain is not on the allowlist" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("creator_external_links")
      .update({
        status: body.action === "approve" ? "approved" : "rejected",
        rejection_reason: body.action === "reject" ? (body.reason ?? "Not approved") : null,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    return jsonError(error);
  }
}
