import { NextRequest, NextResponse } from "next/server";
import { requireVerifiedCreator } from "@/lib/authz";
import { jsonError } from "@/lib/http-errors";
import { arePaymentsLive } from "@/lib/payments-live";
import { isVerifiedCreatorProfile, listWithdrawals, requestWithdrawal } from "@/lib/payouts";

export async function GET() {
  try {
    const { user } = await requireVerifiedCreator();
    const withdrawals = await listWithdrawals(user.id);
    return NextResponse.json({
      success: true,
      paymentsLive: arePaymentsLive(),
      withdrawals,
    });
  } catch (err: unknown) {
    return jsonError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!arePaymentsLive()) {
      return NextResponse.json(
        { success: false, error: "Payouts are not available yet." },
        { status: 403 }
      );
    }

    const { user } = await requireVerifiedCreator();
    if (!(await isVerifiedCreatorProfile(user.id))) {
      return NextResponse.json(
        { success: false, error: "Identity verification is required before withdrawing." },
        { status: 403 }
      );
    }

    const body = (await request.json().catch(() => null)) as {
      methodId?: unknown;
      amountCents?: unknown;
    } | null;

    if (typeof body?.methodId !== "string" || body.methodId.length === 0) {
      return NextResponse.json({ success: false, error: "methodId is required" }, { status: 400 });
    }
    if (typeof body.amountCents !== "number" || !Number.isInteger(body.amountCents)) {
      return NextResponse.json(
        { success: false, error: "amountCents must be an integer" },
        { status: 400 }
      );
    }

    const idempotencyKey = request.headers.get("Idempotency-Key")?.trim() ?? "";
    if (idempotencyKey.length < 8) {
      return NextResponse.json(
        { success: false, error: "Idempotency-Key header is required" },
        { status: 400 }
      );
    }

    const result = await requestWithdrawal({
      creatorId: user.id,
      methodId: body.methodId,
      amountCents: body.amountCents,
      idempotencyKey,
    });

    if (!result.success) {
      const status = result.insufficient ? 402 : 400;
      return NextResponse.json(
        { success: false, error: result.error, balance_cents: result.balanceCents },
        { status }
      );
    }

    return NextResponse.json({
      success: true,
      idempotent: result.idempotent,
      requestId: result.requestId,
      status: result.status,
      amountCents: result.amountCents,
      balanceCents: result.balanceCents,
    });
  } catch (err: unknown) {
    return jsonError(err);
  }
}
