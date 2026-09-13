/**
 * GET /api/cron/settlement
 *
 * Matures creator earnings from pending to available, then verifies the
 * accounting identities still hold.
 *
 * Reconciliation runs after every settlement, not on a separate schedule,
 * because settlement is the operation most likely to break the identities and
 * the cheapest moment to notice is immediately. A non-zero difference is
 * reported as a critical alert but does not fail the settlement — the money has
 * already moved correctly or not at all inside a transaction; the alert is
 * about a discrepancy elsewhere in the books.
 */

import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { runReconciliation, settleMaturedEarnings } from "@/lib/settlement";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    logger.warn("CRON_SECRET not configured, refusing cron request", {
      endpoint: "/api/cron/settlement",
    });
    return NextResponse.json({ error: "Service not configured" }, { status: 503 });
  }

  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settlement = await settleMaturedEarnings();

  if (!settlement.success) {
    logger.error("Settlement run failed", { error: settlement.error });
    return NextResponse.json({ success: false, error: settlement.error }, { status: 500 });
  }

  const reconciliation = await runReconciliation();

  if (!reconciliation.balanced) {
    logger.error("Reconciliation identities do not hold after settlement", {
      rows: reconciliation.rows.filter((r) => Number(r.difference) !== 0),
    });
  }

  return NextResponse.json({
    success: true,
    settlement,
    reconciliation: {
      balanced: reconciliation.balanced,
      failing: reconciliation.rows.filter((r) => Number(r.difference) !== 0),
    },
  });
}
