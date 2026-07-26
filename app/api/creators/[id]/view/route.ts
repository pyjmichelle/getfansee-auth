/**
 * Profile view tracking (Pre-Payment Alpha analytics).
 *
 * POST /api/creators/[id]/view — increments today's aggregate view counter.
 *
 * - Works for guests (no auth) — discovery traffic is the Alpha KPI.
 * - Aggregate-only: no per-viewer rows, no PII.
 * - Uses the admin client because increment_profile_view() is service-role
 *   only (anon/authenticated cannot write counters directly).
 */

import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/http-errors";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { checkRateLimit, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";

// Guests hit this on every profile page load — generous enough for normal
// browsing, tight enough to stop a script from inflating one creator's count.
const VIEW_LIMIT = 60;
const VIEW_WINDOW_MS = 60_000;

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      return NextResponse.json({ success: false, error: "Invalid creator id" }, { status: 400 });
    }

    const rateLimit = checkRateLimit(`view:${getClientIp(request)}`, VIEW_LIMIT, VIEW_WINDOW_MS);
    if (!rateLimit.success) {
      return NextResponse.json(
        { success: false, error: "Too many requests" },
        { status: 429, headers: rateLimitHeaders(rateLimit) }
      );
    }

    const supabase = getSupabaseAdminClient();

    // Only count views for real, active creators.
    const { data: creator } = await supabase
      .from("profiles")
      .select("id, role, is_banned")
      .eq("id", id)
      .maybeSingle();
    if (!creator || creator.role !== "creator" || creator.is_banned) {
      return NextResponse.json({ success: false, error: "Creator not found" }, { status: 404 });
    }

    const { error } = await supabase.rpc("increment_profile_view", { p_creator_id: id });
    if (error) {
      // Migration 047 not applied yet — degrade silently (tracking is best-effort).
      console.warn("[creators/view] increment failed (migration 047?):", error.message);
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return jsonError(err);
  }
}
