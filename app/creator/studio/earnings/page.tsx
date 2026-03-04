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
  Plus,
  BarChart3,
  FileText,
} from "@/lib/icons";
import { PageShell } from "@/components/page-shell";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { format } from "date-fns";
import { useCountUp } from "@/hooks/use-count-up";
import { getAuthBootstrap } from "@/lib/auth-bootstrap-client";
import { useSkeletonMetric } from "@/hooks/use-skeleton-metric";

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
  useSkeletonMetric("creator_earnings_page", isLoading);

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);

        const bootstrap = await getAuthBootstrap();
        if (!bootstrap.authenticated || !bootstrap.user) {
          router.push("/auth");
          return;
        }
        if (bootstrap.profile?.role !== "creator") {
          router.push("/home");
          return;
        }
        setCurrentUser({
          username: bootstrap.profile?.display_name || bootstrap.user.email.split("@")[0] || "user",
          role: "creator",
          avatar: bootstrap.profile?.avatar_url || undefined,
        });

        // 加载收益数据（通过 API）
        const response = await fetch("/api/paywall/earnings");
        if (response.ok) {
          const earnings = await response.json();
          setTransactions(earnings);
        } else {
          console.error("[earnings] Failed to fetch earnings");
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
  const animatedAvailable = useCountUp(availableBalance, { duration: 900, decimals: 2 });
  const animatedPending = useCountUp(pendingBalance, { duration: 900, decimals: 2 });
  const animatedSubsRevenue = useCountUp(subscriptionRevenue, { duration: 900, decimals: 0 });
  const animatedUnlockRevenue = useCountUp(unlockRevenue, { duration: 900, decimals: 0 });
  const animatedTipRevenue = useCountUp(tipRevenue, { duration: 900, decimals: 0 });

  if (isLoading) {
    return (
      <PageShell user={currentUser} notificationCount={0} maxWidth="6xl">
        <div className="pb-24 animate-pulse space-y-6">
          <div className="h-10 w-48 bg-surface-raised rounded" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="h-48 bg-surface-raised rounded-2xl" />
            <div className="h-48 bg-surface-raised rounded-2xl" />
          </div>
          <div className="h-64 bg-surface-raised rounded-2xl" />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell user={currentUser} notificationCount={0} maxWidth="6xl">
      <div className="pb-24 flex flex-col lg:flex-row gap-8">
        <main className="flex-1 min-w-0">
          {/* Header */}
          <div className="mb-4 md:mb-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <Link
                  href="/creator/studio"
                  className="p-2.5 hover:bg-surface-raised rounded-xl transition-colors active:scale-95 focus-visible:ring-2 focus-visible:ring-brand-primary"
                >
                  <ArrowLeft size={24} />
                </Link>
                <div>
                  <h1 className="text-2xl md:text-4xl font-bold tracking-tight mb-1 md:mb-3 text-text-primary">
                    Earnings
                  </h1>
                  <p className="text-text-tertiary text-sm md:text-lg">
                    Track revenue and manage payouts
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="px-5 py-3 bg-surface-raised border-border-base hover:bg-surface-overlay"
                >
                  <Download size={18} />
                  Export
                </Button>
                <Button variant="subscribe-gradient" className="px-5 py-3">
                  <ArrowRight size={18} />
                  Request Payout
                </Button>
              </div>
            </div>
          </div>

          {/* Primary Balance Cards */}
          <div className="bento-grid mb-4 md:mb-10">
            {/* Available Balance */}
            <div
              className="bento-2x2 card-block bg-gradient-subtle p-4 md:p-8 relative overflow-hidden"
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
                      ${animatedAvailable.toFixed(2)}
                    </div>
                    <div className="text-sm text-text-secondary">Ready to withdraw</div>
                  </div>
                  <div className="w-14 h-14 bg-success/10 rounded-2xl flex items-center justify-center">
                    <DollarSign size={28} className="text-success" />
                  </div>
                </div>

                <Button
                  variant="success-gradient"
                  className="w-full px-6 py-3.5 flex items-center justify-center gap-2"
                >
                  <ArrowRight size={18} />
                  Request Payout
                </Button>
              </div>
            </div>

            {/* Pending Payout */}
            <div className="bento-2x1 card-block p-4 md:p-8">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <div className="text-sm text-text-tertiary font-semibold mb-2 uppercase tracking-wide">
                    Pending Payout
                  </div>
                  <div className="text-5xl font-bold tracking-tight mb-2 text-text-primary">
                    ${animatedPending.toFixed(2)}
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
          <div className="card-block p-4 md:p-8 mb-10">
            <div className="mb-6">
              <h3 className="text-lg font-bold mb-1 text-text-primary">Revenue Breakdown</h3>
              <p className="text-sm text-text-tertiary">Earnings by source</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard
                title="Subscriptions"
                value={`$${animatedSubsRevenue.toFixed(0)}`}
                description={`${subscriptionPercent}% of total`}
                icon={<Users className="w-5 h-5" />}
                className="border border-border-base hover:border-brand-primary/30 transition-all"
              />
              <StatCard
                title="Unlocks"
                value={`$${animatedUnlockRevenue.toFixed(0)}`}
                description={`${unlockPercent}% of total`}
                icon={<Unlock className="w-5 h-5" />}
                className="border border-border-base hover:border-brand-secondary/30 transition-all"
              />
              <StatCard
                title="Tips"
                value={`$${animatedTipRevenue.toFixed(0)}`}
                description={`${tipPercent}% of total`}
                icon={<Gift className="w-5 h-5" />}
                className="border border-border-base hover:border-success/30 transition-all"
              />
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="card-block overflow-hidden" data-testid="earnings-history">
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
        </main>

        {/* Sidebar: Studio nav + quick actions (PC) */}
        <aside className="w-full lg:w-72 shrink-0">
          <div className="sticky top-24 space-y-4">
            <div className="card-block p-4">
              <h2 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-3">
                Studio
              </h2>
              <nav className="space-y-1" aria-label="Studio navigation">
                {[
                  { href: "/creator/new-post", icon: Plus, label: "Create Post" },
                  { href: "/creator/studio/earnings", icon: DollarSign, label: "Earnings" },
                  { href: "/creator/studio/subscribers", icon: Users, label: "Subscribers" },
                  { href: "/creator/studio/post/list", icon: FileText, label: "Post List" },
                  { href: "/creator/studio/analytics", icon: BarChart3, label: "Analytics" },
                ].map(({ href, icon: Icon, label }) => {
                  const isActive = href === "/creator/studio/earnings";
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-95 focus-visible:ring-2 focus-visible:ring-brand-primary ${
                        isActive
                          ? "bg-brand-primary/10 text-brand-primary"
                          : "text-text-secondary hover:bg-surface-raised hover:text-text-primary"
                      }`}
                    >
                      <Icon size={16} />
                      {label}
                    </Link>
                  );
                })}
              </nav>
            </div>
            <div className="card-block p-4">
              <h2 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-3">
                Quick actions
              </h2>
              <div className="space-y-2">
                <Link
                  href="/creator/studio/earnings"
                  className="w-full px-4 py-3 bg-success text-white rounded-xl font-semibold hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-glow active:scale-95 focus-visible:ring-2 focus-visible:ring-brand-primary"
                >
                  <ArrowRight size={18} />
                  Request Payout
                </Link>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full px-4 py-3 bg-surface-raised border-border-base hover:bg-surface-overlay flex items-center justify-center gap-2"
                >
                  <Download size={18} />
                  Export
                </Button>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </PageShell>
  );
}
