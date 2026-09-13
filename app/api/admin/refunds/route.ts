/**
 * Manual refunds. Admin only, and deliberately manual.
 *
 * There is no automatic refund path and there should not be one at this stage:
 * every reversal either claws money back from a creator or books a debt against
 * them, and that decision needs a person. Volume is low enough that a human
 * reviewing each one costs less than an automation that gets it wrong.
 *
 * POST — reverse a purchase, or return unspent balance.
 * GET  — list recent reversible orders for the review queue.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { jsonError } from "@/lib/http-errors";
import { reverseConsumptionOrder, refundUnspentBalance } from "@/lib/settlement";
import { listRecentConsumptionOrders } from "@/lib/settlement-queries";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") ?? 50) || 50, 200);
    const orders = await listRecentConsumptionOrders(limit);
    return NextResponse.json({ success: true, orders });
  } catch (err: unknown) {
    return jsonError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAdmin();

    const body = (await request.json().catch(() => null)) as {
      kind?: "reverse_order" | "return_balance";
      consumptionOrderId?: string;
      userId?: string;
      amountCents?: number;
      externalReference?: string;
      reason?: string;
    } | null;

    const reason = body?.reason?.trim();
    if (!reason) {
      return NextResponse.json(
        { success: false, error: "A reason is required — it is the audit trail." },
        { status: 400 }
      );
    }

    if (body?.kind === "reverse_order") {
      if (!body.consumptionOrderId) {
        return NextResponse.json(
          { success: false, error: "consumptionOrderId is required" },
          { status: 400 }
        );
      }

      const result = await reverseConsumptionOrder(
        body.consumptionOrderId,
        `${reason} (by ${user.id})`
      );

      if (!result.success) {
        return NextResponse.json({ success: false, error: result.error }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        idempotent: result.idempotent,
        orderId: result.orderId,
        case: result.case,
        fanBalanceCents: result.fanBalanceCents,
      });
    }

    if (body?.kind === "return_balance") {
      if (!body.userId || !body.amountCents || !body.externalReference) {
        return NextResponse.json(
          {
            success: false,
            error:
              "userId, amountCents and externalReference are required. The external reference " +
              "is the off-platform transfer id and doubles as the idempotency key.",
          },
          { status: 400 }
        );
      }

      const result = await refundUnspentBalance({
        userId: body.userId,
        amountCents: body.amountCents,
        reason: `${reason} (by ${user.id})`,
        externalReference: body.externalReference,
      });

      if (!result.success) {
        return NextResponse.json({ success: false, error: result.error }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        idempotent: result.idempotent,
        balanceCents: result.balanceCents,
      });
    }

    return NextResponse.json(
      { success: false, error: "kind must be 'reverse_order' or 'return_balance'" },
      { status: 400 }
    );
  } catch (err: unknown) {
    return jsonError(err);
  }
}
