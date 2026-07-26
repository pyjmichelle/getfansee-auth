/**
 * GET /api/admin/creator-links
 *
 * List creator external links for admin review.
 * Auth: requireAdmin()
 *
 * Query params:
 *   status    — filter (pending | approved | rejected); default pending
 *   page      — default 1
 *   page_size — default 20, max 100
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { jsonError } from "@/lib/http-errors";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") ?? "pending";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("page_size") ?? "20", 10) || 20)
    );
    const from = (page - 1) * pageSize;

    const supabase = getSupabaseAdminClient();

    let query = supabase
      .from("creator_external_links")
      .select(
        "id, creator_id, url, label, status, click_count, rejection_reason, reviewed_at, created_at",
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);

    if (status !== "all") query = query.eq("status", status);

    const { data, count, error } = await query;
    if (error) throw error;

    // Attach creator display names for the review UI.
    const creatorIds = Array.from(new Set((data ?? []).map((row) => row.creator_id)));
    const namesById = new Map<string, string>();
    if (creatorIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, email")
        .in("id", creatorIds);
      for (const p of profiles ?? []) {
        namesById.set(p.id, p.display_name || p.email || p.id);
      }
    }

    const items = (data ?? []).map((row) => ({
      ...row,
      creator_name: namesById.get(row.creator_id) ?? row.creator_id,
    }));

    return NextResponse.json({ items, total: count ?? 0, page, page_size: pageSize });
  } catch (error) {
    return jsonError(error);
  }
}
