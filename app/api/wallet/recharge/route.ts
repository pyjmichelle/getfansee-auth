import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { jsonError } from "@/lib/http-errors";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { isLocalDevelopmentOrTest } from "@/lib/test-environment";

/** Test-only funding: balance and deposit record commit in one transaction. */
export async function POST(request: NextRequest) {
  try {
    if (!isLocalDevelopmentOrTest()) {
      return NextResponse.json(
        { success: false, error: "Mock top-ups are unavailable." },
        { status: 403 }
      );
    }
    const { user } = await requireUser();
    const body = await request.json().catch(() => null);
    const amount = body?.amount;
    const amountCents = typeof amount === "number" ? Math.round(amount * 100) : NaN;
    if (
      !Number.isFinite(amount) ||
      !Number.isSafeInteger(amountCents) ||
      amountCents < 1 ||
      amountCents > 50_000
    ) {
      return NextResponse.json(
        { success: false, error: "Amount must be between $0.01 and $500." },
        { status: 400 }
      );
    }
    const nonce = request.headers.get("Idempotency-Key") ?? randomUUID();
    if (!nonce.trim() || nonce.length > 200) {
      return NextResponse.json(
        { success: false, error: "Invalid idempotency key" },
        { status: 400 }
      );
    }
    const { data, error } = await getSupabaseAdminClient().rpc("recharge_wallet", {
      p_user_id: user.id,
      p_amount_cents: amountCents,
      p_idempotency_key: `mock_${user.id}_${nonce}`,
    });
    if (error || data?.success !== true) {
      return NextResponse.json({ success: false, error: "Recharge failed" }, { status: 500 });
    }
    return NextResponse.json({
      success: true,
      balance: data.balance_cents / 100,
      idempotent: data.idempotent === true,
    });
  } catch (error) {
    return jsonError(error);
  }
}
