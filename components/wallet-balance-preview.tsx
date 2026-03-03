"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Wallet, Plus } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { getAuthBootstrap } from "@/lib/auth-bootstrap-client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const supabase = getSupabaseBrowserClient();

interface WalletBalancePreviewProps {
  className?: string;
}

export function WalletBalancePreview({ className }: WalletBalancePreviewProps) {
  const pathname = usePathname();
  const [balance, setBalance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    const loadBalance = async () => {
      try {
        const bootstrap = await getAuthBootstrap();
        if (!bootstrap.authenticated || !bootstrap.user) {
          setIsLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from("wallet_accounts")
          .select("available_balance_cents")
          .eq("user_id", bootstrap.user.id)
          .single();

        if (error) {
          if (error.code === "PGRST116") {
            const { data: newWallet, error: insertError } = await supabase
              .from("wallet_accounts")
              .insert({
                user_id: bootstrap.user.id,
                available_balance_cents: 0,
                pending_balance_cents: 0,
              })
              .select()
              .single();

            if (!insertError && newWallet) {
              setBalance(newWallet.available_balance_cents);
            }
          } else {
            console.error("[WalletBalancePreview] Error loading balance:", error);
          }
        } else if (data) {
          setBalance(data.available_balance_cents);
        }
      } catch (err) {
        console.error("[WalletBalancePreview] Error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadBalance();

    let channel: ReturnType<typeof supabase.channel> | null = null;
    // Avoid duplicate realtime subscriptions on wallet page itself.
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
  }, [pathname]);

  const balanceDollars = balance !== null ? (balance / 100).toFixed(2) : "0.00";

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          className={`w-full justify-start gap-3 h-auto py-3 px-4 hover:bg-brand-primary/5 active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-brand-primary min-h-[56px] ${className}`}
          aria-label={`Wallet balance: $${balanceDollars}. Click to add funds.`}
        >
          <div className="w-10 h-10 rounded-lg bg-brand-accent/10 flex items-center justify-center shrink-0">
            <Wallet className="w-5 h-5 text-brand-accent" aria-hidden="true" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-xs text-text-tertiary">Wallet Balance</p>
            {isLoading ? (
              <Skeleton className="h-5 w-20 mt-0.5" />
            ) : (
              <p className="text-lg font-bold text-gradient-primary">${balanceDollars}</p>
            )}
          </div>
          <Plus className="w-4 h-4 text-text-tertiary shrink-0" aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-surface-base border-border-base text-text-primary">
        <DialogHeader>
          <DialogTitle className="text-text-primary">Recharge Wallet</DialogTitle>
          <DialogDescription className="text-text-tertiary">
            Choose an amount to add to your wallet
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 mt-4">
          {[10, 25, 50, 100, 200, 500].map((amount) => (
            <Button
              key={amount}
              variant="outline"
              className="border-border-base hover:bg-brand-primary/10 hover:border-brand-primary/40 active:scale-95 transition-all min-h-[44px] focus-visible:ring-2 focus-visible:ring-brand-primary"
              onClick={() => {
                setIsDialogOpen(false);
              }}
              aria-label={`Add $${amount} to wallet`}
            >
              ${amount}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
