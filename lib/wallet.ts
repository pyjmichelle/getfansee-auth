"use client";

/**
 * Wallet 数据访问层
 * 钱包账户、充值、交易记录
 */

import { getSupabaseBrowserClient } from "./supabase-browser";
import { getCurrentUser } from "./auth";

const supabase = getSupabaseBrowserClient();

/**
 * 充值（Mock 支付处理）
 * @param userId 用户 ID
 * @param amount 充值金额（美元）
 * @returns true 成功，false 失败
 */
export async function deposit(userId: string, amount: number): Promise<boolean> {
  try {
    const amountCents = Math.round(amount * 100);

    // 1. 确保钱包账户存在
    const { data: walletData, error: walletError } = await supabase
      .from("wallet_accounts")
      .select("available_balance_cents")
      .eq("user_id", userId)
      .single();

    if (walletError && walletError.code === "PGRST116") {
      // 创建钱包账户
      const { error: insertError } = await supabase.from("wallet_accounts").insert({
        user_id: userId,
        available_balance_cents: amountCents,
        pending_balance_cents: 0,
      });

      if (insertError) {
        console.error("[wallet] deposit: create wallet error:", insertError);
        return false;
      }
    } else if (walletData) {
      // 更新余额
      const newBalance = walletData.available_balance_cents + amountCents;
      const { error: updateError } = await supabase
        .from("wallet_accounts")
        .update({ available_balance_cents: newBalance })
        .eq("user_id", userId);

      if (updateError) {
        console.error("[wallet] deposit: update balance error:", updateError);
        return false;
      }
    } else if (walletError) {
      console.error("[wallet] deposit: get wallet error:", walletError);
      return false;
    }

    // 2. 创建交易记录
    const { error: transactionError } = await supabase.from("transactions").insert({
      user_id: userId,
      type: "deposit",
      amount_cents: amountCents,
      status: "completed",
      metadata: {
        payment_method: "mock",
        amount_usd: amount,
      },
    });

    if (transactionError) {
      console.error("[wallet] deposit: create transaction error:", transactionError);
      // 即使交易记录创建失败，余额已更新，返回成功
    }

    return true;
  } catch (err) {
    console.error("[wallet] deposit exception:", err);
    return false;
  }
}

/**
 * 获取钱包余额
 * @param userId 用户 ID
 * @returns { available: number, pending: number } 或 null
 */
export async function getWalletBalance(userId: string): Promise<{
  available: number;
  pending: number;
} | null> {
  try {
    const { data, error } = await supabase
      .from("wallet_accounts")
      .select("available_balance_cents, pending_balance_cents")
      .eq("user_id", userId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // 钱包不存在，创建默认钱包
        const { data: newWallet, error: insertError } = await supabase
          .from("wallet_accounts")
          .insert({
            user_id: userId,
            available_balance_cents: 0,
            pending_balance_cents: 0,
          })
          .select()
          .single();

        if (insertError || !newWallet) {
          console.error("[wallet] getWalletBalance: create wallet error:", insertError);
          return null;
        }

        return {
          available: newWallet.available_balance_cents / 100,
          pending: newWallet.pending_balance_cents / 100,
        };
      }

      console.error("[wallet] getWalletBalance error:", error);
      return null;
    }

    if (!data) {
      return null;
    }

    return {
      available: data.available_balance_cents / 100,
      pending: data.pending_balance_cents / 100,
    };
  } catch (err) {
    console.error("[wallet] getWalletBalance exception:", err);
    return null;
  }
}

/**
 * 获取交易记录
 * @param userId 用户 ID
 * @returns 交易列表
 */
export async function getTransactions(userId: string): Promise<
  Array<{
    id: string;
    type: string;
    amount_cents: number;
    status: string;
    created_at: string;
    metadata: any;
  }>
> {
  try {
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("[wallet] getTransactions error:", error);
      return [];
    }

    return (data || []).map((t: any) => ({
      id: t.id,
      type: t.type,
      amount_cents: t.amount_cents,
      status: t.status,
      created_at: t.created_at,
      metadata: t.metadata,
    }));
  } catch (err) {
    console.error("[wallet] getTransactions exception:", err);
    return [];
  }
}
