"use client";

import { useState, useEffect } from "react";
import { Wallet, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { getCurrentUser } from "@/lib/auth";
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
  const [balance, setBalance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    const loadBalance = async () => {
      try {
        const user = await getCurrentUser();
        if (!user) {
          setIsLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from("user_wallets")
          .select("balance_cents")
          .eq("user_id", user.id)
          .single();

        if (error) {
          // 如果钱包不存在，创建默认钱包
          if (error.code === "PGRST116") {
            const { data: newWallet, error: insertError } = await supabase
              .from("user_wallets")
              .insert({ user_id: user.id, balance_cents: 0 })
              .select()
              .single();

            if (!insertError && newWallet) {
              setBalance(newWallet.balance_cents);
            }
          } else {
            console.error("[WalletBalancePreview] Error loading balance:", error);
          }
        } else if (data) {
          setBalance(data.balance_cents);
        }
      } catch (err) {
        console.error("[WalletBalancePreview] Error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadBalance();

    // 监听钱包变化
    const channel = supabase
      .channel("wallet-balance-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_wallets",
        },
        () => {
          loadBalance();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const balanceDollars = balance !== null ? (balance / 100).toFixed(2) : "0.00";

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          className={`w-full justify-start gap-3 h-auto py-3 px-4 hover:bg-white/5 ${className}`}
        >
          <div className="w-10 h-10 rounded-lg bg-[#14B8A6]/10 flex items-center justify-center">
            <Wallet className="w-5 h-5 text-[#14B8A6]" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-xs text-muted-foreground">Wallet Balance</p>
            {isLoading ? (
              <p className="text-sm font-semibold text-foreground">Loading...</p>
            ) : (
              <p className="text-lg font-bold text-foreground">${balanceDollars}</p>
            )}
          </div>
          <Plus className="w-4 h-4 text-muted-foreground" />
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-[#0a0a0a] border-[#1A1A1A] text-foreground">
        <DialogHeader>
          <DialogTitle className="text-foreground">Recharge Wallet</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Choose an amount to add to your wallet
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 mt-4">
          {[10, 25, 50, 100, 200, 500].map((amount) => (
            <Button
              key={amount}
              variant="outline"
              className="border-[#1A1A1A] hover:bg-[#14B8A6]/10 hover:border-[#14B8A6] hover:scale-105 active:scale-95"
              onClick={async () => {
                // TODO: 实现充值逻辑
                console.log(`Recharge $${amount}`);
                setIsDialogOpen(false);
              }}
            >
              ${amount}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
