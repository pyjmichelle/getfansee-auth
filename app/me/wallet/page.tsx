"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { NavHeader } from "@/components/nav-header";
import { Button } from "@/components/ui/button";
import { CenteredContainer } from "@/components/layouts/centered-container";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { getProfile } from "@/lib/profile";
import { ensureProfile } from "@/lib/auth";
import { getWalletBalance, getTransactions } from "@/lib/wallet";
import { Wallet, Plus, ArrowDown, ArrowUp } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { BottomNavigation } from "@/components/bottom-navigation";
import { EmptyState } from "@/components/empty-state";

const supabase = getSupabaseBrowserClient();

interface Transaction {
  id: string;
  type: string;
  amount_cents: number;
  status: string;
  created_at: string;
  metadata?: {
    amount_usd?: number;
    post_id?: string;
    creator_id?: string;
  } | null;
}

export default function WalletPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [availableBalance, setAvailableBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [currentUser, setCurrentUser] = useState<{
    username: string;
    role: "fan" | "creator";
    avatar?: string;
  } | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [isRecharging, setIsRecharging] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "success" | "failed">("idle");

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

        setIsLoading(false);

        // 余额与交易记录异步加载，避免阻塞首屏
        void (async () => {
          try {
            const balanceData = await getWalletBalance(session.user.id);
            if (balanceData) {
              setAvailableBalance(balanceData.available);
            }

            const transactionsData = await getTransactions(session.user.id);
            setTransactions(transactionsData);
          } catch (loadErr) {
            console.error("[wallet] background load error:", loadErr);
          }
        })();
      } catch (err) {
        console.error("[wallet] loadData error:", err);
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
      toast.error("Please select an amount");
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
        toast.success(`Successfully recharged $${selectedAmount}`);
        setPaymentStatus("success");
        setSelectedAmount(null);

        // 更新余额显示
        setAvailableBalance(result.balance);

        // 重新加载交易记录
        const transactionsData = await getTransactions(currentUserId);
        setTransactions(transactionsData);

        // Reset status after 3 seconds
        setTimeout(() => setPaymentStatus("idle"), 3000);
      } else {
        toast.error(result.error || "Recharge failed, please try again");
        setPaymentStatus("failed");
        setTimeout(() => setPaymentStatus("idle"), 3000);
      }
    } catch (err: unknown) {
      console.error("[wallet] recharge error:", err);
      const message = err instanceof Error ? err.message : "Recharge failed, please try again";
      toast.error(message);
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
        {currentUser && <NavHeader user={currentUser!} notificationCount={0} />}
        <main className="py-6 sm:py-8 lg:py-12">
          <CenteredContainer maxWidth="4xl">
            <div className="animate-pulse space-y-8">
              <div className="h-32 bg-muted rounded-xl"></div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="h-24 bg-muted rounded-xl"></div>
                ))}
              </div>
            </div>
          </CenteredContainer>
        </main>

        <BottomNavigation notificationCount={0} userRole={currentUser?.role} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-16 md:pb-0" data-testid="wallet-page">
      {currentUser && <NavHeader user={currentUser!} notificationCount={0} />}

      <main className="py-6 sm:py-8 lg:py-12">
        <CenteredContainer maxWidth="4xl">
          {/* 余额显示 */}
          <div className="mb-12 text-center" data-testid="wallet-balance-section">
            <div className="inline-block relative">
              <div className="absolute -inset-4 bg-primary/20 blur-2xl rounded-full"></div>
              <div className="relative">
                <p className="text-sm text-muted-foreground mb-2">Wallet Balance</p>
                <h1
                  className="text-6xl md:text-7xl font-bold text-foreground mb-2"
                  data-testid="wallet-balance-value"
                >
                  ${availableBalance.toFixed(2)}
                </h1>
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <Wallet className="w-5 h-5" aria-hidden="true" />
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
                  data-testid={`recharge-amount-${amount}`}
                  data-amount={amount}
                  data-selected={selectedAmount === amount ? "true" : "false"}
                  className={`
                    relative p-6 rounded-xl border-2 transition-[border-color,background-color,box-shadow] duration-200 motion-safe:transition-[border-color,background-color,box-shadow] motion-reduce:transition-none
                    ${
                      selectedAmount === amount
                        ? "border-primary bg-primary/10 shadow-lg"
                        : "border-border bg-card hover:border-primary/50"
                    }
                  `}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedAmount(amount);
                    }
                  }}
                  aria-label={`Select $${amount} recharge amount`}
                  aria-pressed={selectedAmount === amount}
                >
                  {selectedAmount === amount && (
                    <div className="absolute -inset-0.5 bg-primary/20 rounded-xl opacity-50"></div>
                  )}
                  <div className="relative">
                    <p className="text-2xl font-bold text-foreground">${amount}</p>
                    <p className="text-xs text-muted-foreground mt-1">Recharge</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Payment Status Indicators (for testing) */}
            {paymentStatus === "success" && (
              <div
                className="mt-4 p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-500 text-center"
                data-testid="payment-success"
              >
                Payment successful! Your balance has been updated.
              </div>
            )}
            {paymentStatus === "failed" && (
              <div
                className="mt-4 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-center"
                data-testid="payment-fail"
              >
                Payment failed. Please try again.
              </div>
            )}

            {/* Checkout Disclaimer */}
            <div
              className="mt-6 p-4 rounded-xl bg-muted/50 border border-border text-sm space-y-2"
              data-testid="checkout-disclaimer"
            >
              <p className="font-medium text-foreground" data-testid="no-refund">
                Digital goods. No refunds.
              </p>
              <p className="text-muted-foreground">
                You must be 18 years or older to use this service. All purchases are final.
              </p>
              <p className="text-muted-foreground">
                By clicking "Recharge", you agree to our{" "}
                <a
                  href="/terms"
                  className="text-primary underline hover:no-underline"
                  data-testid="terms-link"
                >
                  Terms of Service
                </a>{" "}
                and{" "}
                <a
                  href="/privacy"
                  className="text-primary underline hover:no-underline"
                  data-testid="privacy-link"
                >
                  Privacy Policy
                </a>
                .
              </p>
            </div>

            <Button
              onClick={handleRecharge}
              disabled={!selectedAmount || isRecharging}
              data-testid="recharge-submit-button"
              data-selected-amount={selectedAmount ?? 0}
              className="w-full mt-4 rounded-xl min-h-[44px] transition-[transform,opacity] duration-200 motion-safe:transition-[transform,opacity] motion-reduce:transition-none"
              aria-label={`Recharge $${selectedAmount || 0}`}
            >
              {isRecharging ? (
                "Processing…"
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" aria-hidden="true" />
                  Recharge ${selectedAmount || 0}
                </>
              )}
            </Button>
          </div>

          {/* 交易历史 */}
          <div data-testid="transaction-history">
            <h2 className="text-2xl font-semibold text-foreground mb-6">Transaction History</h2>
            {transactions.length === 0 ? (
              <EmptyState
                data-testid="transaction-empty"
                icon={<Wallet className="w-8 h-8 text-muted-foreground" />}
                title="No Transactions Yet"
                description="Your transaction history will appear here once you make your first transaction."
              />
            ) : (
              <div className="space-y-4">
                {transactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="bg-card border border-border rounded-xl p-6 flex items-center justify-between shadow-sm hover:shadow-md transition-[box-shadow] duration-200 motion-safe:transition-[box-shadow] motion-reduce:transition-none"
                    data-testid="transaction-row"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`
                          w-12 h-12 rounded-xl flex items-center justify-center
                          ${
                            getTransactionType(transaction.type) === "recharge"
                              ? "bg-green-500/10 text-green-600 dark:text-green-400"
                              : "bg-destructive/10 text-destructive"
                          }
                        `}
                      >
                        {getTransactionType(transaction.type) === "recharge" ? (
                          <ArrowDown className="w-6 h-6" aria-hidden="true" />
                        ) : (
                          <ArrowUp className="w-6 h-6" aria-hidden="true" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          {getTransactionDescription(transaction)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(transaction.created_at), {
                            addSuffix: true,
                          })}
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
        </CenteredContainer>
      </main>
    </div>
  );
}
