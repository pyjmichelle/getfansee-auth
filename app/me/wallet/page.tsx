"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { NavHeader } from "@/components/nav-header";
import { Button } from "@/components/ui/button";
// CenteredContainer no longer needed - using Figma max-w layout
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { getProfile } from "@/lib/profile";
import { ensureProfile } from "@/lib/auth";
import { getWalletBalance, getTransactions } from "@/lib/wallet";
import {
  Wallet,
  Plus,
  ArrowDown,
  ArrowUp,
  TrendingUp,
  Calendar,
  Unlock,
  Download,
  AlertTriangle,
  CreditCard,
  X,
  CheckCircle,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { BottomNavigation } from "@/components/bottom-navigation";
// EmptyState no longer needed - using inline empty state

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

  const [showAddFunds, setShowAddFunds] = useState(false);
  const [filterType, setFilterType] = useState<"all" | "added" | "spent">("all");

  // Funding options with bonus
  const fundingOptions = [
    { amount: 25, bonus: 0 },
    { amount: 50, bonus: 5, popular: true },
    { amount: 100, bonus: 12 },
    { amount: 200, bonus: 30 },
  ];

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

  // Calculate monthly spending
  const monthlySpending =
    transactions.filter((t) => t.type !== "deposit").reduce((sum, t) => sum + t.amount_cents, 0) /
    100;

  // Filter transactions
  const filteredTransactions = transactions.filter((t) => {
    if (filterType === "all") return true;
    if (filterType === "added") return t.type === "deposit";
    return t.type !== "deposit";
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-20 md:pb-0">
        {currentUser && <NavHeader user={currentUser!} notificationCount={0} />}
        <div className="pt-20 md:pt-24 px-4 md:px-6 max-w-5xl mx-auto">
          <div className="animate-pulse space-y-8">
            <div className="h-32 bg-surface-raised rounded-2xl"></div>
            <div className="grid grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 bg-surface-raised rounded-2xl"></div>
              ))}
            </div>
          </div>
        </div>
        <BottomNavigation notificationCount={0} userRole={currentUser?.role} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0" data-testid="wallet-page">
      {currentUser && <NavHeader user={currentUser!} notificationCount={0} />}

      <div className="pt-20 md:pt-24 px-4 md:px-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2 text-text-primary">Wallet</h1>
          <p className="text-text-tertiary">Manage your balance and transactions</p>
        </div>

        {/* Low Balance Warning - Figma Style */}
        {availableBalance < 20 && (
          <div className="bg-warning/10 border border-warning/30 rounded-2xl p-5 mb-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-warning/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6 text-warning" />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-warning mb-1.5">Low Balance Alert</h4>
                <p className="text-sm text-text-secondary mb-4">
                  You have ${availableBalance.toFixed(2)} remaining. Add funds now to avoid missing
                  out on exclusive content drops.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddFunds(true)}
                  className="border-warning/30 text-warning hover:bg-warning/10"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Funds Now
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Balance Card - Figma Style */}
        <div
          className="bg-gradient-subtle border border-border-base rounded-2xl p-6 md:p-8 mb-8 relative overflow-hidden"
          data-testid="wallet-balance-section"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-brand-primary/10 to-brand-secondary/10"></div>
          <div className="relative z-10">
            <div className="flex items-start justify-between mb-8">
              <div>
                <div className="text-text-tertiary mb-2 font-semibold">Available Balance</div>
                <div
                  className="text-4xl md:text-5xl font-bold text-gradient-primary"
                  data-testid="wallet-balance-value"
                >
                  ${availableBalance.toFixed(2)}
                </div>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-brand-primary-alpha-10 flex items-center justify-center">
                <Wallet className="w-7 h-7 text-brand-primary" />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setShowAddFunds(true)}
                className="flex-1 px-6 py-3.5 bg-brand-primary text-white rounded-xl font-semibold hover:bg-brand-primary-subtle transition-all flex items-center justify-center gap-2 shadow-lg shadow-brand-primary/25 active:scale-95"
              >
                <Plus className="w-5 h-5" />
                Add Funds
              </button>
              <button className="flex-1 px-6 py-3.5 bg-surface-raised border border-border-base rounded-xl font-semibold hover:bg-surface-overlay transition-all flex items-center justify-center gap-2 active:scale-95">
                <Download className="w-5 h-5" />
                Download Statement
              </button>
            </div>
          </div>
        </div>

        {/* Quick Stats - Figma Style */}
        <div className="grid md:grid-cols-3 gap-4 md:gap-6 mb-8">
          <div className="bg-surface-base border border-border-base rounded-2xl p-6 hover:border-brand-primary/30 transition-all">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-text-tertiary font-semibold">This Month</div>
              <div className="w-12 h-12 bg-error/10 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-error" />
              </div>
            </div>
            <div className="text-2xl font-bold mb-1 text-text-primary">
              ${monthlySpending.toFixed(2)}
            </div>
            <div className="text-xs text-text-tertiary">Total spending</div>
          </div>

          <div className="bg-surface-base border border-border-base rounded-2xl p-6 hover:border-brand-primary/30 transition-all">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-text-tertiary font-semibold">Subscriptions</div>
              <div className="w-12 h-12 bg-brand-primary-alpha-10 rounded-xl flex items-center justify-center">
                <Calendar className="w-5 h-5 text-brand-primary" />
              </div>
            </div>
            <div className="text-2xl font-bold mb-1 text-text-primary">-</div>
            <div className="text-xs text-text-tertiary">Active subscriptions</div>
          </div>

          <div className="bg-surface-base border border-border-base rounded-2xl p-6 hover:border-brand-primary/30 transition-all">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-text-tertiary font-semibold">Unlocks</div>
              <div className="w-12 h-12 bg-brand-secondary/10 rounded-xl flex items-center justify-center">
                <Unlock className="w-5 h-5 text-brand-secondary" />
              </div>
            </div>
            <div className="text-2xl font-bold mb-1 text-text-primary">
              {transactions.filter((t) => t.type === "ppv_purchase").length}
            </div>
            <div className="text-xs text-text-tertiary">This month</div>
          </div>
        </div>

        {/* Transactions - Figma Style */}
        <div
          className="bg-surface-base border border-border-base rounded-2xl overflow-hidden"
          data-testid="transaction-history"
        >
          <div className="p-6 border-b border-border-base">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h3 className="text-lg font-bold text-text-primary">Transaction History</h3>

              <div className="flex gap-2 bg-surface-raised border border-border-base rounded-xl p-1">
                <button
                  onClick={() => setFilterType("all")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    filterType === "all"
                      ? "bg-brand-primary text-white shadow-md"
                      : "text-text-tertiary hover:bg-surface-overlay hover:text-text-primary"
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilterType("added")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    filterType === "added"
                      ? "bg-brand-primary text-white shadow-md"
                      : "text-text-tertiary hover:bg-surface-overlay hover:text-text-primary"
                  }`}
                >
                  Added
                </button>
                <button
                  onClick={() => setFilterType("spent")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    filterType === "spent"
                      ? "bg-brand-primary text-white shadow-md"
                      : "text-text-tertiary hover:bg-surface-overlay hover:text-text-primary"
                  }`}
                >
                  Spent
                </button>
              </div>
            </div>
          </div>

          <div className="divide-y divide-border-subtle">
            {filteredTransactions.map((transaction) => (
              <div
                key={transaction.id}
                className="p-6 hover:bg-surface-raised transition-colors"
                data-testid="transaction-row"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        getTransactionType(transaction.type) === "recharge"
                          ? "bg-success/10"
                          : "bg-brand-primary-alpha-10"
                      }`}
                    >
                      {getTransactionType(transaction.type) === "recharge" ? (
                        <ArrowDown className="w-5 h-5 text-success" />
                      ) : (
                        <ArrowUp className="w-5 h-5 text-brand-primary" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="font-semibold mb-1 text-text-primary">
                        {getTransactionDescription(transaction)}
                      </div>
                      <div className="text-sm text-text-tertiary">
                        {formatDistanceToNow(new Date(transaction.created_at), { addSuffix: true })}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div
                      className={`text-lg font-bold ${
                        getTransactionType(transaction.type) === "recharge"
                          ? "text-success"
                          : "text-text-primary"
                      }`}
                    >
                      {getTransactionType(transaction.type) === "recharge" ? "+" : "-"}$
                      {(transaction.amount_cents / 100).toFixed(2)}
                    </div>
                    <div className="text-xs text-text-tertiary capitalize flex items-center gap-1 justify-end">
                      <CheckCircle className="w-3 h-3 text-success" />
                      {transaction.status}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredTransactions.length === 0 && (
            <div className="p-12 text-center" data-testid="transaction-empty">
              <div className="w-16 h-16 bg-surface-raised rounded-full flex items-center justify-center mx-auto mb-4">
                <Wallet className="w-7 h-7 text-text-quaternary" />
              </div>
              <h4 className="font-semibold mb-1 text-text-primary">No transactions</h4>
              <p className="text-sm text-text-tertiary">No {filterType} transactions to display</p>
            </div>
          )}
        </div>
      </div>

      {/* Checkout Disclaimer */}
      <div className="max-w-5xl mx-auto px-4 md:px-6 mb-8" data-testid="checkout-disclaimer">
        <div className="bg-surface-raised border border-border-base rounded-2xl p-6 text-sm text-text-tertiary space-y-2">
          <p data-testid="no-refund">All purchases are final and non-refundable.</p>
          <p>
            By adding funds, you agree to our{" "}
            <a
              href="/terms"
              className="text-brand-primary hover:underline"
              data-testid="terms-link"
            >
              Terms of Service
            </a>{" "}
            and{" "}
            <a
              href="/privacy"
              className="text-brand-primary hover:underline"
              data-testid="privacy-link"
            >
              Privacy Policy
            </a>
            .
          </p>
        </div>
      </div>

      {/* Add Funds Modal - Figma Style */}
      {showAddFunds && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-base border border-border-base rounded-2xl max-w-md w-full shadow-2xl">
            <div className="p-6 border-b border-border-base flex items-center justify-between">
              <h3 className="text-xl font-bold text-text-primary">Add Funds</h3>
              <button
                onClick={() => setShowAddFunds(false)}
                className="w-10 h-10 rounded-xl hover:bg-surface-raised transition-all flex items-center justify-center active:scale-90"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              <div className="mb-6">
                <label className="block text-sm font-semibold mb-3 text-text-secondary">
                  Select Amount
                </label>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {fundingOptions.map(({ amount: amt, bonus, popular }) => (
                    <button
                      key={amt}
                      onClick={() => setSelectedAmount(amt)}
                      data-testid={`recharge-amount-${amt}`}
                      className={`relative px-4 py-4 rounded-xl border-2 transition-all font-semibold active:scale-95 ${
                        popular
                          ? "border-brand-accent bg-brand-accent/10 shadow-glow-gold"
                          : selectedAmount === amt
                            ? "border-brand-primary bg-brand-primary-alpha-10 text-brand-primary"
                            : "border-border-base hover:border-brand-primary/50 hover:bg-surface-raised"
                      }`}
                    >
                      {popular && (
                        <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-brand-accent text-white text-xs font-bold rounded-full whitespace-nowrap">
                          POPULAR
                        </div>
                      )}
                      <div className="text-xl font-bold mb-1">${amt}</div>
                      {bonus > 0 && (
                        <div className="text-xs text-success font-semibold">+${bonus} bonus</div>
                      )}
                      {bonus === 0 && <div className="text-xs text-text-tertiary">No bonus</div>}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-semibold mb-3 text-text-secondary">
                  Payment Method
                </label>
                <button className="w-full p-4 border-2 border-brand-primary bg-brand-primary/5 rounded-xl flex items-center gap-3 hover:bg-brand-primary/10 transition-all active:scale-95">
                  <div className="w-12 h-12 bg-brand-primary text-white rounded-xl flex items-center justify-center">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <div className="font-semibold text-text-primary">Credit/Debit Card</div>
                    <div className="text-sm text-text-tertiary">Visa, Mastercard, Amex</div>
                  </div>
                </button>
              </div>

              {/* Payment Status */}
              {paymentStatus === "success" && (
                <div
                  className="mb-4 p-4 rounded-xl bg-success/10 border border-success/20 text-success text-center"
                  data-testid="payment-success"
                >
                  Payment successful! Your balance has been updated.
                </div>
              )}
              {paymentStatus === "failed" && (
                <div
                  className="mb-4 p-4 rounded-xl bg-error/10 border border-error/20 text-error text-center"
                  data-testid="payment-fail"
                >
                  Payment failed. Please try again.
                </div>
              )}

              <div className="space-y-3">
                <button
                  disabled={!selectedAmount || isRecharging}
                  onClick={handleRecharge}
                  data-testid="recharge-submit-button"
                  className="w-full px-6 py-3.5 bg-brand-primary text-white rounded-xl font-semibold hover:bg-brand-primary-subtle transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-brand-primary/25 active:scale-95"
                >
                  {isRecharging ? "Processing..." : `Add $${selectedAmount || "0.00"}`}
                </button>
                <button
                  onClick={() => {
                    setShowAddFunds(false);
                    setSelectedAmount(null);
                  }}
                  className="w-full px-6 py-3.5 bg-surface-raised border border-border-base rounded-xl font-semibold hover:bg-surface-overlay transition-all active:scale-95"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <BottomNavigation notificationCount={0} userRole={currentUser?.role} />
    </div>
  );
}
