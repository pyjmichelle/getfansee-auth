/**
 * GET /api/admin/referrals
 *
 * List/search referral attributions with full admin fields.
 * Auth: requireAdmin()
 *
 * Query params:
 *   status    — filter by attribution status
 *   page      — default 1
 *   page_size — default 20, max 100
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { jsonError, HttpError } from "@/lib/http-errors";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("page_size") ?? "20", 10) || 20)
    );
    const from = (page - 1) * pageSize;

    const supabase = getSupabaseAdminClient();

    let query = supabase
      .from("creator_referral_attributions")
      .select(
        "id, referrer_user_id, referred_user_id, referral_code, source, status, " +
          "qualified_at, window_ends_at, risk_flags, is_fraud, signup_ip, " +
          "bound_by_admin, created_at, updated_at",
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);

    if (status) query = query.eq("status", status);

    const { data, count, error } = await query;
    if (error) throw error;

    return NextResponse.json({ items: data ?? [], total: count ?? 0, page, page_size: pageSize });
  } catch (error) {
    if (error instanceof HttpError) return jsonError(error);
    return jsonError(error);
  }
}
