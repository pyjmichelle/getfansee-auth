import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { jsonError } from "@/lib/http-errors";

/**
 * GET /api/admin/kyc
 * 获取待审核的 KYC 验证列表（仅限 admin）
 */
export async function GET(_request: NextRequest) {
  try {
    await requireAdmin();

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("creator_verifications")
      .select(
        `
        id,
        user_id,
        real_name,
        birth_date,
        country,
        id_doc_urls,
        status,
        created_at,
        kyc_provider,
        kyc_session_id,
        kyc_external_status,
        kyc_started_at,
        kyc_submitted_at,
        kyc_decided_at,
        kyc_age_verified,
        kyc_last_error,
        profiles!creator_verifications_user_id_fkey (
          display_name,
          avatar_url
        )
      `
      )
      .in("status", ["pending", "initiated", "in_progress", "submitted"])
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[api/admin/kyc] GET error:", error);
      return NextResponse.json({ error: "Failed to fetch verifications" }, { status: 500 });
    }

    type VerificationRow = {
      id: string;
      user_id: string;
      real_name: string;
      birth_date: string;
      country: string;
      id_doc_urls: string[];
      status: string;
      created_at: string;
      kyc_provider?: string;
      kyc_session_id?: string;
      kyc_external_status?: string;
      kyc_started_at?: string;
      kyc_submitted_at?: string;
      kyc_decided_at?: string;
      kyc_age_verified?: boolean;
      kyc_last_error?: string;
      profiles?: { display_name?: string; avatar_url?: string } | null;
    };

    const verifications = ((data as VerificationRow[]) || []).map((v) => ({
      id: v.id,
      user_id: v.user_id,
      real_name: v.real_name,
      birth_date: v.birth_date,
      country: v.country,
      id_doc_urls: v.id_doc_urls,
      status: v.status,
      created_at: v.created_at,
      kyc_provider: v.kyc_provider,
      kyc_session_id: v.kyc_session_id,
      kyc_external_status: v.kyc_external_status,
      kyc_started_at: v.kyc_started_at,
      kyc_submitted_at: v.kyc_submitted_at,
      kyc_decided_at: v.kyc_decided_at,
      kyc_age_verified: v.kyc_age_verified,
      kyc_last_error: v.kyc_last_error,
      user: v.profiles
        ? { display_name: v.profiles.display_name, avatar_url: v.profiles.avatar_url }
        : undefined,
    }));

    return NextResponse.json({ verifications });
  } catch (error) {
    return jsonError(error);
  }
}

/**
 * PATCH /api/admin/kyc
 * 审核 KYC 申请：批准或拒绝（仅限 admin）
 *
 * Body: { verificationId: string, approve: boolean, reason?: string }
 */
export async function PATCH(request: NextRequest) {
  try {
    const { user } = await requireAdmin();

    const body = await request.json();
    const { verificationId, approve, reason } = body as {
      verificationId: string;
      approve: boolean;
      reason?: string;
    };

    if (!verificationId || typeof approve !== "boolean") {
      return NextResponse.json(
        { error: "verificationId and approve are required" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdminClient();

    // Fetch user_id first so we can update both tables atomically in sequence.
    // A separate SELECT before the UPDATE is safe here: the verification row
    // is only modified by admin actions, so there is no meaningful TOCTOU risk.
    const { data: verification, error: fetchError } = await supabase
      .from("creator_verifications")
      .select("user_id")
      .eq("id", verificationId)
      .single();

    if (fetchError || !verification) {
      console.error("[api/admin/kyc] PATCH fetch verification error:", fetchError);
      return NextResponse.json({ error: "Verification not found" }, { status: 404 });
    }

    const { error: updateVerifError } = await supabase
      .from("creator_verifications")
      .update({
        status: approve ? "approved" : "rejected",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        rejection_reason: approve ? null : reason || null,
      })
      .eq("id", verificationId);

    if (updateVerifError) {
      console.error("[api/admin/kyc] PATCH update verification error:", updateVerifError);
      return NextResponse.json({ error: "Failed to update verification" }, { status: 500 });
    }

    // Sync profiles.age_verified on approval — user_id already known, no extra SELECT
    if (approve) {
      const { error: updateProfileError } = await supabase
        .from("profiles")
        .update({ age_verified: true })
        .eq("id", verification.user_id);

      if (updateProfileError) {
        console.error(
          "[api/admin/kyc] PATCH update profile age_verified error:",
          updateProfileError
        );
        // Verification status was already updated; log the inconsistency but don't
        // return 500 (the KYC status is the source of truth; age_verified is derived).
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return jsonError(error);
  }
}
