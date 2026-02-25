"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  DollarSign,
  Download,
  Clock,
  Users,
  Unlock,
  Gift,
  ArrowUpRight,
  CheckCircle,
  CreditCard,
  ArrowRight,
} from "lucide-react";
import { NavHeader } from "@/components/nav-header";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { ensureProfile } from "@/lib/auth";
import { getProfile } from "@/lib/profile";
import Link from "next/link";
import { format } from "date-fns";
import { BottomNavigation } from "@/components/bottom-navigation";

const supabase = getSupabaseBrowserClient();

interface Transaction {
  id: string;
  type: string;
  amount_cents: number;
  status: string;
  available_on: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}

export default function EarningsPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [_timeRange, _setTimeRange] = useState<"7d" | "30d" | "90d" | "all">("30d");
  const [currentUser, setCurrentUser] = useState<{
    username: string;
    role: "fan" | "creator";
    avatar?: string;
  } | null>(null);

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
        const profile = await getProfile(session.user.id);
        if (profile) {
          setCurrentUser({
            username: profile.display_name || "user",
            role: (profile.role || "fan") as "fan" | "creator",
            avatar: profile.avatar_url || undefined,
          });

          if (profile.role !== "creator") {
            router.push("/home");
            return;
          }

          // 加载收益数据（通过 API）
          const response = await fetch("/api/paywall/earnings");
          if (response.ok) {
            const earnings = await response.json();
            setTransactions(earnings);
          } else {
            console.error("[earnings] Failed to fetch earnings");
          }
        }
      } catch (err) {
        console.error("[earnings] loadData error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [router]);

  // 计算统计数据
  const completedTransactions = transactions.filter((t) => t.status === "completed");
  const pendingTransactions = transactions.filter((t) => t.status === "pending");

  const totalEarnings = completedTransactions.reduce((sum, t) => sum + t.amount_cents, 0) / 100;
  const pendingEarnings = pendingTransactions.reduce((sum, t) => sum + t.amount_cents, 0) / 100;

  const _platformFee = totalEarnings * 0.2;
  const yourCut = totalEarnings * 0.8;

  // 可提金额（已结算的）
  const availableBalance = yourCut;

  // 待结算金额（pending 的，需要等待 available_on）
  const pendingBalance = pendingEarnings * 0.8;

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "MMM d, yyyy HH:mm");
  };

  const formatAvailableDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    return format(new Date(dateString), "MMM d, yyyy");
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "subscription":
        return "Subscription";
      case "ppv_purchase":
        return "Pay Per View";
      case "commission":
        return "Commission";
      case "tip":
        return "Tip";
      case "payout":
        return "Payout";
      default:
        return type;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "subscription":
        return <Users size={20} className="text-brand-primary" />;
      case "ppv_purchase":
      case "unlock":
        return <Unlock size={20} className="text-brand-secondary" />;
      case "tip":
        return <Gift size={20} className="text-success" />;
      case "payout":
        return <ArrowUpRight size={20} className="text-error" />;
      default:
        return <DollarSign size={20} className="text-text-tertiary" />;
    }
  };

  const getTypeBgColor = (type: string) => {
    switch (type) {
      case "subscription":
        return "bg-brand-primary/10";
      case "ppv_purchase":
      case "unlock":
        return "bg-brand-secondary/10";
      case "tip":
        return "bg-success/10";
      case "payout":
        return "bg-error/10";
      default:
        return "bg-surface-raised";
    }
  };

  // Revenue breakdown stats
  const subscriptionRevenue =
    transactions
      .filter((t) => t.type === "subscription" && t.status === "completed")
      .reduce((sum, t) => sum + t.amount_cents, 0) / 100;
  const unlockRevenue =
    transactions
      .filter((t) => (t.type === "ppv_purchase" || t.type === "unlock") && t.status === "completed")
      .reduce((sum, t) => sum + t.amount_cents, 0) / 100;
  const tipRevenue =
    transactions
      .filter((t) => t.type === "tip" && t.status === "completed")
      .reduce((sum, t) => sum + t.amount_cents, 0) / 100;

  const totalRevenueForBreakdown = subscriptionRevenue + unlockRevenue + tipRevenue || 1;
  const subscriptionPercent = Math.round((subscriptionRevenue / totalRevenueForBreakdown) * 100);
  const unlockPercent = Math.round((unlockRevenue / totalRevenueForBreakdown) * 100);
  const tipPercent = Math.round((tipRevenue / totalRevenueForBreakdown) * 100);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-20 md:pb-0">
        {currentUser && <NavHeader user={currentUser} notificationCount={0} />}
        <div className="pt-20 md:pt-24 px-4 md:px-6 max-w-7xl mx-auto pb-12">
          <div className="animate-pulse space-y-6">
            <div className="h-10 w-48 bg-surface-raised rounded" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="h-48 bg-surface-raised rounded-2xl" />
              <div className="h-48 bg-surface-raised rounded-2xl" />
            </div>
            <div className="h-64 bg-surface-raised rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      {currentUser && <NavHeader user={currentUser} notificationCount={0} />}

      <div className="pt-20 md:pt-24 px-4 md:px-6 max-w-7xl mx-auto pb-12">
        {/* Header */}
        <div className="mb-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <Link
                href="/creator/studio"
                className="p-2.5 hover:bg-surface-raised rounded-xl transition-colors"
              >
                <ArrowLeft size={24} />
              </Link>
              <div>
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3 text-text-primary">
                  Earnings
                </h1>
                <p className="text-text-tertiary text-lg">Track revenue and manage payouts</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button className="px-5 py-3 bg-surface-raised border border-border-base rounded-xl font-semibold hover:bg-surface-overlay transition-all flex items-center gap-2 active:scale-95">
                <Download size={18} />
                Export
              </button>
              <button className="px-5 py-3 bg-brand-secondary text-white rounded-xl font-semibold hover:opacity-90 transition-all flex items-center gap-2 shadow-lg shadow-brand-secondary/25 active:scale-95">
                <ArrowRight size={18} />
                Request Payout
              </button>
            </div>
          </div>
        </div>

        {/* Primary Balance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          {/* Available Balance */}
          <div
            className="bg-gradient-subtle border border-border-base rounded-2xl p-8 shadow-xl relative overflow-hidden"
            data-testid="earnings-balance"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-success/10 to-transparent" />
            <div className="relative z-10">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <div className="text-sm text-text-tertiary font-semibold mb-2 uppercase tracking-wide">
                    Available Balance
                  </div>
                  <div className="text-5xl font-bold tracking-tight mb-2 text-gradient-primary">
                    ${availableBalance.toFixed(2)}
                  </div>
                  <div className="text-sm text-text-secondary">Ready to withdraw</div>
                </div>
                <div className="w-14 h-14 bg-success/10 rounded-2xl flex items-center justify-center">
                  <DollarSign size={28} className="text-success" />
                </div>
              </div>

              <button className="w-full px-6 py-3.5 bg-success text-white rounded-xl font-semibold hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-success/25 active:scale-95">
                <ArrowRight size={18} />
                Request Payout
              </button>
            </div>
          </div>

          {/* Pending Payout */}
          <div className="bg-surface-base border border-border-base rounded-2xl p-8 shadow-xl">
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="text-sm text-text-tertiary font-semibold mb-2 uppercase tracking-wide">
                  Pending Payout
                </div>
                <div className="text-5xl font-bold tracking-tight mb-2 text-text-primary">
                  ${pendingBalance.toFixed(2)}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock size={14} className="text-brand-secondary" />
                  <span className="text-text-secondary">
                    {pendingTransactions.length > 0 && pendingTransactions[0].available_on
                      ? `Estimated ${formatAvailableDate(pendingTransactions[0].available_on)}`
                      : "Processing"}
                  </span>
                </div>
              </div>
              <div className="w-14 h-14 bg-brand-secondary/10 rounded-2xl flex items-center justify-center">
                <Clock size={28} className="text-brand-secondary" />
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-text-tertiary">
              <CreditCard size={14} />
              <span>Bank •••• 4242</span>
            </div>
          </div>
        </div>

        {/* Revenue Breakdown */}
        <div className="bg-surface-base border border-border-base rounded-2xl p-8 mb-10 shadow-xl">
          <div className="mb-6">
            <h3 className="text-lg font-bold mb-1 text-text-primary">Revenue Breakdown</h3>
            <p className="text-sm text-text-tertiary">Earnings by source</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 bg-gradient-subtle rounded-xl border border-border-base hover:border-brand-primary/30 transition-all">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-brand-primary/10 rounded-xl flex items-center justify-center">
                  <Users size={22} className="text-brand-primary" />
                </div>
                <div>
                  <div className="text-xs text-text-tertiary font-semibold uppercase tracking-wide">
                    Subscriptions
                  </div>
                  <div className="text-2xl font-bold text-text-primary">
                    ${subscriptionRevenue.toFixed(0)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-surface-raised rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-primary rounded-full transition-all"
                    style={{ width: `${subscriptionPercent}%` }}
                  />
                </div>
                <span className="text-sm font-semibold text-text-tertiary">
                  {subscriptionPercent}%
                </span>
              </div>
            </div>

            <div className="p-6 bg-gradient-subtle rounded-xl border border-border-base hover:border-brand-secondary/30 transition-all">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-brand-secondary/10 rounded-xl flex items-center justify-center">
                  <Unlock size={22} className="text-brand-secondary" />
                </div>
                <div>
                  <div className="text-xs text-text-tertiary font-semibold uppercase tracking-wide">
                    Unlocks
                  </div>
                  <div className="text-2xl font-bold text-text-primary">
                    ${unlockRevenue.toFixed(0)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-surface-raised rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-secondary rounded-full transition-all"
                    style={{ width: `${unlockPercent}%` }}
                  />
                </div>
                <span className="text-sm font-semibold text-text-tertiary">{unlockPercent}%</span>
              </div>
            </div>

            <div className="p-6 bg-gradient-subtle rounded-xl border border-border-base hover:border-success/30 transition-all">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-success/10 rounded-xl flex items-center justify-center">
                  <Gift size={22} className="text-success" />
                </div>
                <div>
                  <div className="text-xs text-text-tertiary font-semibold uppercase tracking-wide">
                    Tips
                  </div>
                  <div className="text-2xl font-bold text-text-primary">
                    ${tipRevenue.toFixed(0)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-surface-raised rounded-full overflow-hidden">
                  <div
                    className="h-full bg-success rounded-full transition-all"
                    style={{ width: `${tipPercent}%` }}
                  />
                </div>
                <span className="text-sm font-semibold text-text-tertiary">{tipPercent}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Transactions */}
        <div
          className="bg-surface-base border border-border-base rounded-2xl overflow-hidden shadow-xl"
          data-testid="earnings-history"
        >
          <div className="p-6 border-b border-border-base">
            <h3 className="text-lg font-bold text-text-primary">Recent Transactions</h3>
          </div>

          {transactions.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-text-tertiary">No transactions yet</p>
            </div>
          ) : (
            <div className="divide-y divide-border-subtle">
              {transactions.map((transaction) => {
                const amount = transaction.amount_cents / 100;
                const _afterFee = amount * 0.8;
                const isPositive = amount > 0;

                return (
                  <div
                    key={transaction.id}
                    className="p-6 hover:bg-surface-raised transition-colors"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 flex-1">
                        <div
                          className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${getTypeBgColor(
                            transaction.type
                          )}`}
                        >
                          {getTypeIcon(transaction.type)}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="font-semibold mb-1 text-text-primary">
                            {getTypeLabel(transaction.type)}
                          </div>
                          <div className="text-sm text-text-tertiary">
                            {formatDate(transaction.created_at)}
                            {transaction.available_on && transaction.status === "pending" && (
                              <span className="ml-2">
                                • Available {formatAvailableDate(transaction.available_on)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div
                          className={`text-lg font-bold ${
                            isPositive ? "text-success" : "text-error"
                          }`}
                        >
                          {isPositive ? "+" : ""}${Math.abs(amount).toFixed(2)}
                        </div>
                        <div className="text-xs text-text-tertiary capitalize flex items-center gap-1 justify-end">
                          {transaction.status === "completed" ? (
                            <>
                              <CheckCircle size={12} className="text-success" />
                              <span>Completed</span>
                            </>
                          ) : (
                            <>
                              <Clock size={12} className="text-brand-secondary" />
                              <span>Pending</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <BottomNavigation notificationCount={0} userRole={currentUser?.role} />
    </div>
  );
}
