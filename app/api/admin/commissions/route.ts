/**
 * GET /api/admin/commissions
 *
 * List commission records with full admin fields (incl. basis_revenue_cents).
 * Auth: requireAdmin()
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
      .from("creator_referral_commissions")
      .select("*", { count: "exact" })
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
