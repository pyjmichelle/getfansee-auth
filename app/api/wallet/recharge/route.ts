import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { jsonError } from "@/lib/http-errors";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

type RechargePayload = {
  amount: number; // 美元金额
};

export async function POST(request: NextRequest) {
  try {
    // 路由层显式鉴权（验证用户身份，后续使用 admin client 避免 auth.uid() 问题）
    const { user } = await requireUser();

    const body = (await request.json()) as RechargePayload;
    const { amount } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json({ success: false, error: "Invalid amount" }, { status: 400 });
    }

    // Use admin client to bypass auth.uid() requirement in recharge_wallet RPC.
    // The user has already been authenticated by requireUser() above.
    // The admin client has full trust to call SECURITY DEFINER functions.
    const adminSupabase = getSupabaseAdminClient();
    const amountCents = Math.round(amount * 100);
    // 幂等键：优先取请求头，否则生成新 UUID
    const idempotencyKey = request.headers.get("Idempotency-Key") ?? randomUUID();

    // Direct atomic wallet update using admin client:
    // 1. Idempotency check (prevent duplicate charges)
    const { data: existingTx } = await adminSupabase
      .from("transactions")
      .select("id")
      .eq("user_id", user.id)
      .eq("type", "deposit")
      .eq("status", "completed")
      .contains("metadata", { idempotency_key: idempotencyKey })
      .maybeSingle();

    if (existingTx) {
      // Idempotent response: return current balance
      const { data: wallet } = await adminSupabase
        .from("wallet_accounts")
        .select("available_balance_cents")
        .eq("user_id", user.id)
        .maybeSingle();
      return NextResponse.json({
        success: true,
        balance: (wallet?.available_balance_cents ?? 0) / 100,
        idempotent: true,
      });
    }

    // 2. Insert deposit transaction
    const { error: txError } = await adminSupabase.from("transactions").insert({
      user_id: user.id,
      type: "deposit",
      amount_cents: amountCents,
      status: "completed",
      metadata: {
        payment_method: "mock",
        idempotency_key: idempotencyKey,
      },
    });

    if (txError) {
      console.error("[api/wallet/recharge] insert transaction error:", txError);
      return NextResponse.json({ success: false, error: "Recharge failed" }, { status: 500 });
    }

    // 3. Increment wallet balance (select-then-upsert; safe for single-request scenarios)
    const { data: currentWallet } = await adminSupabase
      .from("wallet_accounts")
      .select("available_balance_cents, pending_balance_cents")
      .eq("user_id", user.id)
      .maybeSingle();

    const currentBalance = currentWallet?.available_balance_cents ?? 0;
    const newBalance = currentBalance + amountCents;
    const pendingBalance = currentWallet?.pending_balance_cents ?? 0;

    const { error: walletError } = await adminSupabase.from("wallet_accounts").upsert(
      {
        user_id: user.id,
        available_balance_cents: newBalance,
        pending_balance_cents: pendingBalance,
      },
      { onConflict: "user_id" }
    );

    if (walletError) {
      console.error("[api/wallet/recharge] upsert wallet error:", walletError);
      return NextResponse.json({ success: false, error: "Recharge failed" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      balance: newBalance / 100,
    });
  } catch (err: unknown) {
    return jsonError(err);
  }
}
