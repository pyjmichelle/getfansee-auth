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
    // 路由层显式鉴权
    const { user } = await requireUser();

    const body = (await request.json()) as RechargePayload;
    const { amount } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json({ success: false, error: "Invalid amount" }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const amountCents = Math.round(amount * 100);
    // 幂等键：优先取请求头，否则生成新 UUID
    const idempotencyKey = request.headers.get("Idempotency-Key") ?? randomUUID();

    // 原子操作：在单 RPC/事务内完成钱包更新 + 交易写入，消除账实不一致风险
    const { data, error } = await supabase.rpc("recharge_wallet", {
      p_user_id: user.id,
      p_amount_cents: amountCents,
      p_idempotency_key: idempotencyKey,
    });

    if (error) {
      console.error("[api/wallet/recharge] RPC error:", error);
      return NextResponse.json({ success: false, error: "Recharge failed" }, { status: 500 });
    }

    const result = data as {
      success: boolean;
      balance_cents?: number;
      idempotent?: boolean;
      error?: string;
    };

    if (!result?.success) {
      const message = result?.error || "Recharge failed";
      const status = message.toLowerCase().includes("unauthorized") ? 403 : 400;
      return NextResponse.json({ success: false, error: message }, { status });
    }

    return NextResponse.json({
      success: true,
      balance: (result.balance_cents ?? 0) / 100,
    });
  } catch (err: unknown) {
    return jsonError(err);
  }
}
