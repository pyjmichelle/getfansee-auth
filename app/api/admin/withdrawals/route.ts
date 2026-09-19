import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { jsonError } from "@/lib/http-errors";
import { decideWithdrawal, listPendingWithdrawals, listWithdrawals } from "@/lib/payouts";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const creatorId = request.nextUrl.searchParams.get("creatorId");
    const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") ?? 50) || 50, 200);

    if (creatorId) {
      const withdrawals = await listWithdrawals(creatorId, limit);
      return NextResponse.json({ success: true, withdrawals });
    }

    const withdrawals = await listPendingWithdrawals(limit);
    return NextResponse.json({ success: true, withdrawals });
  } catch (err: unknown) {
    return jsonError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAdmin();
    const body = (await request.json().catch(() => null)) as {
      requestId?: unknown;
      decision?: unknown;
      externalReference?: unknown;
      reason?: unknown;
    } | null;

    if (typeof body?.requestId !== "string" || body.requestId.length === 0) {
      return NextResponse.json({ success: false, error: "requestId is required" }, { status: 400 });
    }
    if (body.decision !== "paid" && body.decision !== "rejected") {
      return NextResponse.json(
        { success: false, error: "decision must be paid or rejected" },
        { status: 400 }
      );
    }

    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (!reason) {
      return NextResponse.json(
        { success: false, error: "A reason is required — it is the audit trail." },
        { status: 400 }
      );
    }

    const result = await decideWithdrawal({
      requestId: body.requestId,
      decision: body.decision,
      externalReference:
        typeof body.externalReference === "string" ? body.externalReference.trim() : undefined,
      reason: `${reason} (by ${user.id})`,
      adminId: user.id,
    });

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      idempotent: result.idempotent,
      requestId: result.requestId,
      status: result.status,
    });
  } catch (err: unknown) {
    return jsonError(err);
  }
}
