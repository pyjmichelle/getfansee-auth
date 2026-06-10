/**
 * POST /api/admin/commissions/[id]/reject
 *
 * Reject a pending commission with a reason.
 * Auth: requireAdmin()
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { jsonError, HttpError } from "@/lib/http-errors";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { user } = await requireAdmin();
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const note = (body.note as string | undefined) ?? "";
    const statusReason = (body.status_reason as string | undefined) ?? "other";

    const supabase = getSupabaseAdminClient();

    const { data: comm, error: fetchError } = await supabase
      .from("creator_referral_commissions")
      .select("attribution_id, status")
      .eq("id", id)
      .single();

    if (fetchError || !comm) {
      return NextResponse.json({ error: "Commission not found" }, { status: 404 });
    }
    if (comm.status !== "pending") {
      return NextResponse.json(
        { error: `Cannot reject: status is ${comm.status}` },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabase
      .from("creator_referral_commissions")
      .update({
        status: "rejected",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        review_note: note || null,
        status_reason: statusReason,
        admin_action_source: "admin_ui",
      })
      .eq("id", id);

    if (updateError) throw updateError;

    await supabase.from("creator_referral_events").insert({
      attribution_id: comm.attribution_id,
      referral_code: null,
      event_type: "commission_rejected",
      actor_user_id: user.id,
      metadata: { commission_id: id, status_reason: statusReason, note, admin_id: user.id },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof HttpError) return jsonError(error);
    return jsonError(error);
  }
}
