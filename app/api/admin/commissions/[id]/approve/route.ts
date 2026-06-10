/**
 * POST /api/admin/commissions/[id]/approve
 *
 * Approve a pending commission.
 * Sets approved_commission_amount_cents = estimated_commission_amount_cents.
 * Optionally mirrors to transactions ledger if mirror_to_ledger=true in settings.
 *
 * Money-safety: does NOT touch wallet_accounts balances.
 * Auth: requireAdmin()
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { jsonError, HttpError } from "@/lib/http-errors";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { logger } from "@/lib/logger";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { user } = await requireAdmin();
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const note = (body.note as string | undefined) ?? "";

    const supabase = getSupabaseAdminClient();

    // Fetch commission row
    const { data: comm, error: fetchError } = await supabase
      .from("creator_referral_commissions")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !comm) {
      return NextResponse.json({ error: "Commission not found" }, { status: 404 });
    }
    if (comm.status !== "pending") {
      return NextResponse.json(
        { error: `Cannot approve: status is ${comm.status}` },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const approvedCents = comm.estimated_commission_amount_cents;

    // Update commission
    const { error: updateError } = await supabase
      .from("creator_referral_commissions")
      .update({
        status: "approved",
        approved_commission_amount_cents: approvedCents,
        reviewed_by: user.id,
        reviewed_at: now,
        review_note: note || null,
        admin_action_source: "admin_ui",
      })
      .eq("id", id);

    if (updateError) throw updateError;

    // Check mirror_to_ledger setting
    const { data: settings } = await supabase
      .from("creator_referral_settings")
      .select("mirror_to_ledger")
      .eq("id", 1)
      .single();

    if (settings?.mirror_to_ledger) {
      // Insert audit-only transactions row — does NOT touch wallet balances
      const { data: txn, error: txnError } = await supabase
        .from("transactions")
        .insert({
          user_id: comm.referrer_user_id,
          type: "commission",
          amount_cents: approvedCents,
          status: "pending",
          available_on: null,
          metadata: {
            kind: "ambassador_commission",
            commission_id: id,
            attribution_id: comm.attribution_id,
            note: "Audit mirror only. Not withdrawable in MVP.",
          },
        })
        .select("id")
        .single();

      if (txnError) {
        logger.warn("[commissions/approve] ledger mirror failed (non-fatal)", {
          commissionId: id,
          err: txnError,
        });
      } else if (txn) {
        await supabase
          .from("creator_referral_commissions")
          .update({ ledger_transaction_id: txn.id })
          .eq("id", id);
      }
    }

    // Emit audit event
    await supabase.from("creator_referral_events").insert({
      attribution_id: comm.attribution_id,
      referral_code: null,
      event_type: "commission_approved",
      actor_user_id: user.id,
      metadata: {
        commission_id: id,
        approved_cents: approvedCents,
        note,
        admin_id: user.id,
      },
    });

    return NextResponse.json({ ok: true, approved_commission_amount_cents: approvedCents });
  } catch (error) {
    if (error instanceof HttpError) return jsonError(error);
    return jsonError(error);
  }
}
