/**
 * POST /api/admin/referrals/[id]/fraud
 *
 * Mark a referral attribution as fraud/rejected.
 * Voids all pending commissions for that attribution.
 * Logs an admin_override event.
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
    const reason = (body.reason as string | undefined) ?? "";

    const supabase = getSupabaseAdminClient();

    // Mark attribution as fraud
    const { error: attrError } = await supabase
      .from("creator_referral_attributions")
      .update({ is_fraud: true, status: "fraud" })
      .eq("id", id);

    if (attrError) throw attrError;

    // Void all pending commissions
    const { error: commError } = await supabase
      .from("creator_referral_commissions")
      .update({
        status: "rejected",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        review_note: reason || "Voided: attribution marked as fraud",
        status_reason: "risk_flag",
        admin_action_source: "admin_ui",
      })
      .eq("attribution_id", id)
      .eq("status", "pending");

    if (commError) throw commError;

    // Emit audit event
    await supabase.from("creator_referral_events").insert({
      attribution_id: id,
      referral_code: null,
      event_type: "fraud_flag",
      actor_user_id: user.id,
      metadata: { reason, admin_id: user.id },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof HttpError) return jsonError(error);
    return jsonError(error);
  }
}
