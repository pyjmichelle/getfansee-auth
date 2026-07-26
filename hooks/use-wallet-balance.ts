"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useAuth } from "@/contexts/auth-context";

const supabase = getSupabaseBrowserClient();

/**
 * Single source of truth for the current user's wallet balance (cents).
 * Shared by WalletBalancePreview and AccountPanel so the two surfaces never
 * drift out of sync (previously AccountPanel never fetched at all and
 * silently rendered $0.00).
 */
export function useWalletBalance() {
  const pathname = usePathname();
  const auth = useAuth();
  const [balanceCents, setBalanceCents] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadBalance = useCallback(async () => {
    try {
      if (!auth.authenticated || !auth.user) {
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("wallet_accounts")
        .select("available_balance_cents")
        .eq("user_id", auth.user.id)
        .maybeSingle();

      if (error) {
        console.error("[useWalletBalance] Error loading balance:", error);
      } else if (data) {
        setBalanceCents(data.available_balance_cents);
      } else {
        setBalanceCents(0);
      }
    } catch (err) {
      console.error("[useWalletBalance] Error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [auth.authenticated, auth.user]);

  useEffect(() => {
    loadBalance();

    // Avoid duplicate realtime subscriptions on the wallet page itself,
    // which already manages its own channel.
    let channel: ReturnType<typeof supabase.channel> | null = null;
    if (pathname !== "/me/wallet") {
      channel = supabase
        .channel("wallet-balance-changes")
        .on("postgres_changes", { event: "*", schema: "public", table: "wallet_accounts" }, () => {
          loadBalance();
        })
        .subscribe();
    }

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [pathname, loadBalance]);

  return {
    balanceCents,
    balanceDollars: balanceCents !== null ? balanceCents / 100 : 0,
    isLoading,
  };
}
