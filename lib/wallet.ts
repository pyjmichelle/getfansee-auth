"use client";

/**
 * Wallet 客户端数据访问层（只读）
 *
 * 充值操作已移至服务端 API 路由 /api/wallet/recharge，
 * 该路由通过 recharge_wallet RPC 以原子事务执行钱包更新 + 交易写入。
 * 本文件仅保留读取函数供客户端组件使用。
 */

import { getSupabaseBrowserClient } from "./supabase-browser";

const supabase = getSupabaseBrowserClient();

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
    metadata: Record<string, unknown> | null;
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

    type TransactionRow = {
      id: string;
      type: string;
      amount_cents: number;
      status: string;
      created_at: string;
      metadata: Record<string, unknown> | null;
    };

    return ((data as TransactionRow[] | null) || []).map((t) => ({
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
