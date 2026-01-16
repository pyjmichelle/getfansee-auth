"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { NavHeader } from "@/components/nav-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { getProfile } from "@/lib/profile";
import { ensureProfile, getCurrentUser } from "@/lib/auth";
import { deposit, getWalletBalance, getTransactions } from "@/lib/wallet";
import { Wallet, Plus, ArrowDown, ArrowUp } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

const supabase = getSupabaseBrowserClient();

interface Transaction {
  id: string;
  type: string;
  amount_cents: number;
  status: string;
  created_at: string;
  metadata?: any;
}

export default function WalletPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [availableBalance, setAvailableBalance] = useState<number>(0);
  const [pendingBalance, setPendingBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [currentUser, setCurrentUser] = useState<{
    username: string;
    role: "fan" | "creator";
    avatar?: string;
  } | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [isRecharging, setIsRecharging] = useState(false);

  const rechargeAmounts = [10, 25, 50, 100, 200, 500];

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          router.push("/auth");
          return;
        }

        await ensureProfile();
        setCurrentUserId(session.user.id);

        // 加载用户信息
        const profile = await getProfile(session.user.id);
        if (profile) {
          setCurrentUser({
            username: profile.display_name || "user",
            role: (profile.role || "fan") as "fan" | "creator",
            avatar: profile.avatar_url || undefined,
          });
        }

        // 加载钱包余额
        const balanceData = await getWalletBalance(session.user.id);
        if (balanceData) {
          setAvailableBalance(balanceData.available);
          setPendingBalance(balanceData.pending);
        }

        // 加载交易记录
        const transactionsData = await getTransactions(session.user.id);
        setTransactions(transactionsData);
      } catch (err) {
        console.error("[wallet] loadData error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();

    // 监听钱包变化
    const channel = supabase
      .channel("wallet-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "wallet_accounts",
        },
        () => {
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  const handleRecharge = async () => {
    if (!selectedAmount || !currentUserId) {
      toast.error("请选择充值金额");
      return;
    }

    try {
      setIsRecharging(true);

      // 调用服务端 API 进行充值
      const response = await fetch("/api/wallet/recharge", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: selectedAmount,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success(`成功充值 $${selectedAmount}`);
        setSelectedAmount(null);

        // 更新余额显示
        setAvailableBalance(result.balance);

        // 重新加载交易记录
        const transactionsData = await getTransactions(currentUserId);
        setTransactions(transactionsData);
      } else {
        toast.error(result.error || "充值失败，请重试");
      }
    } catch (err: any) {
      console.error("[wallet] recharge error:", err);
      toast.error(err.message || "充值失败，请重试");
    } finally {
      setIsRecharging(false);
    }
  };

  const getTransactionType = (type: string): "recharge" | "expense" => {
    if (type === "deposit") return "recharge";
    return "expense";
  };

  const getTransactionDescription = (transaction: Transaction): string => {
    if (transaction.type === "deposit") {
      return transaction.metadata?.amount_usd
        ? `Recharge $${transaction.metadata.amount_usd}`
        : "Recharge";
    } else if (transaction.type === "ppv_purchase") {
      return transaction.metadata?.post_id
        ? `Unlock post ${transaction.metadata.post_id}`
        : "PPV Purchase";
    } else if (transaction.type === "subscription") {
      return transaction.metadata?.creator_id
        ? `Subscription to creator ${transaction.metadata.creator_id}`
        : "Subscription";
    }
    return transaction.type;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        {currentUser && <NavHeader user={currentUser} notificationCount={0} />}
        <main className="container max-w-4xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-8">
            <div className="h-32 bg-[#121212] rounded-3xl"></div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-24 bg-[#121212] rounded-xl"></div>
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {currentUser && <NavHeader user={currentUser} notificationCount={0} />}

      <main className="container max-w-4xl mx-auto px-4 md:px-8 py-8 md:py-12">
        {/* 余额显示 */}
        <div className="mb-12 text-center">
          <div className="inline-block relative">
            <div className="absolute -inset-4 bg-[#6366F1]/20 blur-2xl rounded-full"></div>
            <div className="relative">
              <p className="text-sm text-muted-foreground mb-2">Wallet Balance</p>
              <h1 className="text-6xl md:text-7xl font-bold text-foreground mb-2">
                ${availableBalance.toFixed(2)}
              </h1>
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Wallet className="w-5 h-5" />
                <span className="text-sm">Available</span>
              </div>
            </div>
          </div>
        </div>

        {/* 充值选项 */}
        <div className="mb-12">
          <h2 className="text-2xl font-semibold text-foreground mb-6">Recharge</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {rechargeAmounts.map((amount) => (
              <button
                key={amount}
                onClick={() => setSelectedAmount(amount)}
                className={`
                  relative p-6 rounded-xl border-2 transition-all duration-300
                  ${
                    selectedAmount === amount
                      ? "border-[#6366F1] bg-[#6366F1]/10 shadow-primary-glow"
                      : "border-border bg-card hover:border-[#6366F1]/50"
                  }
                `}
              >
                {selectedAmount === amount && (
                  <div className="absolute -inset-0.5 bg-primary-gradient rounded-xl opacity-50 animate-pulse"></div>
                )}
                <div className="relative">
                  <p className="text-2xl font-bold text-foreground">${amount}</p>
                  <p className="text-xs text-muted-foreground mt-1">Recharge</p>
                </div>
              </button>
            ))}
          </div>

          <Button
            onClick={handleRecharge}
            disabled={!selectedAmount || isRecharging}
            variant="gradient"
            className="w-full mt-6 rounded-xl h-12"
          >
            {isRecharging ? (
              "处理中..."
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                Recharge ${selectedAmount || 0}
              </>
            )}
          </Button>
        </div>

        {/* 交易历史 */}
        <div>
          <h2 className="text-2xl font-semibold text-foreground mb-6">Transaction History</h2>
          {transactions.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Wallet className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No transactions yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="bg-card border border-border rounded-3xl p-6 flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`
                        w-12 h-12 rounded-xl flex items-center justify-center
                        ${
                          getTransactionType(transaction.type) === "recharge"
                            ? "bg-green-500/10 text-green-600 dark:text-green-400"
                            : "bg-[#F43F5E]/10 text-destructive"
                        }
                      `}
                    >
                      {getTransactionType(transaction.type) === "recharge" ? (
                        <ArrowDown className="w-6 h-6" />
                      ) : (
                        <ArrowUp className="w-6 h-6" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">
                        {getTransactionDescription(transaction)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(transaction.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  <div
                    className={`
                      text-lg font-bold
                      ${
                        getTransactionType(transaction.type) === "recharge"
                          ? "text-green-600 dark:text-green-400"
                          : "text-destructive"
                      }
                    `}
                  >
                    {getTransactionType(transaction.type) === "recharge" ? "+" : "-"}$
                    {(transaction.amount_cents / 100).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
