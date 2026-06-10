/**
 * GET  /api/admin/referral-settings  — read current settings
 * PUT  /api/admin/referral-settings  — update settings
 * Auth: requireAdmin()
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { jsonError, HttpError } from "@/lib/http-errors";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export async function GET(): Promise<NextResponse> {
  try {
    await requireAdmin();
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("creator_referral_settings")
      .select("*")
      .eq("id", 1)
      .single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof HttpError) return jsonError(error);
    return jsonError(error);
  }
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    await requireAdmin();
    const body = await request.json();

    // Whitelist updatable fields
    const allowed = [
      "program_enabled",
      "commission_percent",
      "duration_months",
      "commission_cap_cents",
      "approval_delay_days",
      "require_admin_approval",
      "mirror_to_ledger",
    ];

    const update: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) update[key] = body[key];
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("creator_referral_settings")
      .update(update)
      .eq("id", 1)
      .select("*")
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof HttpError) return jsonError(error);
    return jsonError(error);
  }
}
