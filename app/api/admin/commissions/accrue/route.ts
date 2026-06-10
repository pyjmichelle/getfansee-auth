/**
 * POST /api/admin/commissions/accrue
 *
 * Admin-triggered manual accrual run.
 * Auth: requireAdmin()
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { jsonError, HttpError } from "@/lib/http-errors";
import { runAccrual } from "@/lib/ambassador/accrual";

export async function POST(): Promise<NextResponse> {
  try {
    await requireAdmin();
    const result = await runAccrual();
    return NextResponse.json({ ok: true, timestamp: new Date().toISOString(), ...result });
  } catch (error) {
    if (error instanceof HttpError) return jsonError(error);
    return jsonError(error);
  }
}
