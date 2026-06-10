/**
 * GET /api/cron/referral-accrual
 *
 * Vercel cron-compatible endpoint for ambassador commission accrual.
 * Auth: Bearer CRON_SECRET header (same pattern as financial-audit).
 *
 * Money-safety: accrual writes only to creator_referral_commissions.
 * It does NOT touch wallet_accounts or transactions balances.
 */

import { NextRequest, NextResponse } from "next/server";
import { runAccrual } from "@/lib/ambassador/accrual";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    logger.warn("[cron/referral-accrual] CRON_SECRET not configured");
    return NextResponse.json({ error: "Service not configured" }, { status: 503 });
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    logger.warn("[cron/referral-accrual] Unauthorized request");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  logger.info("[cron/referral-accrual] Starting accrual job");

  const result = await runAccrual();

  logger.info(
    "[cron/referral-accrual] Accrual complete",
    result as unknown as Record<string, unknown>
  );

  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    ...result,
  });
}
