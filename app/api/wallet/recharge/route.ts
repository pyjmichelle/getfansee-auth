import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-server";
import { createClient } from "@supabase/supabase-js";

// 使用 Service Role Key 绕过 RLS
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

type RechargePayload = {
  amount: number; // 美元金额
};

export async function POST(request: NextRequest) {
  try {
    // 验证用户身份
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not authenticated" },
        { status: 401 }
      );
    }

    const body = (await request.json()) as RechargePayload;
    const { amount } = body;

    // 验证金额
    if (!amount || amount <= 0) {
      return NextResponse.json({ success: false, error: "Invalid amount" }, { status: 400 });
    }

    // Removed debug console.log - vercel-react-best-practices

    // 使用 Admin 客户端绕过 RLS
    const supabase = getSupabaseAdmin();
    const amountCents = Math.round(amount * 100);

    // 1. 获取或创建钱包账户
    const { data: wallet, error: walletError } = await supabase
      .from("wallet_accounts")
      .select("available_balance_cents")
      .eq("user_id", user.id)
      .maybeSingle();

    if (walletError) {
      console.error("[api/wallet/recharge] Error fetching wallet:", walletError);
      return NextResponse.json(
        { success: false, error: "Failed to fetch wallet" },
        { status: 500 }
      );
    }

    let newBalance: number;

    if (!wallet) {
      // 创建新钱包
      const { error: insertError } = await supabase.from("wallet_accounts").insert({
        user_id: user.id,
        available_balance_cents: amountCents,
        pending_balance_cents: 0,
      });

      if (insertError) {
        console.error("[api/wallet/recharge] Error creating wallet:", insertError);
        return NextResponse.json(
          { success: false, error: "Failed to create wallet" },
          { status: 500 }
        );
      }

      newBalance = amountCents;
    } else {
      // 更新现有钱包
      newBalance = wallet.available_balance_cents + amountCents;
      const { error: updateError } = await supabase
        .from("wallet_accounts")
        .update({ available_balance_cents: newBalance })
        .eq("user_id", user.id);

      if (updateError) {
        console.error("[api/wallet/recharge] Error updating wallet:", updateError);
        return NextResponse.json(
          { success: false, error: "Failed to update wallet" },
          { status: 500 }
        );
      }
    }

    // 2. 创建交易记录
    const { error: transactionError } = await supabase.from("transactions").insert({
      user_id: user.id,
      type: "deposit",
      amount_cents: amountCents,
      status: "completed",
      metadata: {
        payment_method: "mock",
        amount_usd: amount,
      },
    });

    if (transactionError) {
      console.error("[api/wallet/recharge] Error creating transaction:", transactionError);
      // 不返回错误，因为余额已更新
    }

    // Removed debug console.log - vercel-react-best-practices

    return NextResponse.json({
      success: true,
      balance: newBalance / 100,
    });
  } catch (err: unknown) {
    console.error("[api/wallet/recharge] Exception:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
