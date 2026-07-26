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
} from "@/lib/icons";
import { PageShell } from "@/components/page-shell";
import { StudioShell } from "@/components/shells/studio-shell";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { format } from "date-fns";
import { useCountUp } from "@/hooks/use-count-up";
import { useAuth } from "@/contexts/auth-context";
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
  const auth = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d" | "all">("all");
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

        if (!auth.authenticated || !auth.user) {
          router.push("/auth");
          return;
        }
        if (auth.profile?.role !== "creator") {
          router.push("/home");
          return;
        }
        setCurrentUser({
          username: auth.profile?.display_name || auth.user.email.split("@")[0] || "user",
          role: "creator",
          avatar: auth.profile?.avatar_url || undefined,
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
  }, [router, auth.authenticated, auth.user, auth.profile]);

  // Filter by selected time range (applies to the breakdown + history list; the
  // available/pending balance cards always reflect the full lifetime total).
  const rangeStartMs =
    timeRange === "all"
      ? 0
      : Date.now() - { "7d": 7, "30d": 30, "90d": 90 }[timeRange] * 24 * 60 * 60 * 1000;
  const filteredTransactions = transactions.filter(
    (t) => new Date(t.created_at).getTime() >= rangeStartMs
  );

  // 计算统计数据
  const completedTransactions = transactions.filter((t) => t.status === "completed");
  const pendingTransactions = transactions.filter((t) => t.status === "pending");

  // Tips are already stored NET of the platform fee (see /api/tip + lib/constants/fees).
  // Other sources keep the legacy 0.8 estimate; tips must not be discounted twice.
  const sumCents = (rows: Transaction[]) => rows.reduce((sum, t) => sum + t.amount_cents, 0);
  const completedTipCents = sumCents(completedTransactions.filter((t) => t.type === "tip"));
  const completedNonTipCents = sumCents(completedTransactions.filter((t) => t.type !== "tip"));
  const pendingTipCents = sumCents(pendingTransactions.filter((t) => t.type === "tip"));
  const pendingNonTipCents = sumCents(pendingTransactions.filter((t) => t.type !== "tip"));

  // 可提金额（已结算的）: tips at true net + non-tip legacy estimate
  const availableBalance = (completedNonTipCents * 0.8 + completedTipCents) / 100;

  // 待结算金额（pending 的，需要等待 available_on）
  const pendingBalance = (pendingNonTipCents * 0.8 + pendingTipCents) / 100;

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
        return <Users size={20} className="text-wine-text" />;
      case "ppv_purchase":
      case "unlock":
        return <Unlock size={20} className="text-wine-text" />;
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

  // Revenue breakdown stats (respects the selected time range)
  const subscriptionRevenue =
    filteredTransactions
      .filter((t) => t.type === "subscription" && t.status === "completed")
      .reduce((sum, t) => sum + t.amount_cents, 0) / 100;
  const unlockRevenue =
    filteredTransactions
      .filter((t) => (t.type === "ppv_purchase" || t.type === "unlock") && t.status === "completed")
      .reduce((sum, t) => sum + t.amount_cents, 0) / 100;
  const tipRevenue =
    filteredTransactions
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

  const handleExportCsv = () => {
    const header = ["Date", "Type", "Status", "Amount (USD)", "Available On"];
    const rows = filteredTransactions.map((t) => [
      formatDate(t.created_at),
      getTypeLabel(t.type),
      t.status,
      (t.amount_cents / 100).toFixed(2),
      t.available_on ? formatAvailableDate(t.available_on) : "",
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `earnings-${timeRange}-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

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
      <div className="pb-24">
        <StudioShell
          sidebarExtra={
            <div className="card-block p-4">
              <h2 className="text-tiny font-semibold text-text-muted uppercase tracking-wider mb-3">
                Quick actions
              </h2>
              <div className="space-y-2">
                <Button variant="default" size="md" className="w-full" asChild>
                  <Link href="/creator/new-post">
                    <Plus size={16} aria-hidden />
                    Create Post
                  </Link>
                </Button>
                <Button variant="outline" size="md" className="w-full" asChild>
                  <Link href="/creator/studio/ambassador">
                    <ArrowRight size={16} aria-hidden />
                    Refer Creators
                  </Link>
                </Button>
              </div>
            </div>
          }
        >
          {/* Header */}
          <div className="mb-4 md:mb-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <Link
                  href="/creator/studio"
                  className="p-2.5 hover:bg-surface-raised rounded-xl transition-colors active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-brand-primary"
                >
                  <ArrowLeft size={24} />
                </Link>
                <div>
                  <h1 className="text-h2 md:text-h1 text-text-primary">Earnings</h1>
                  <p className="text-text-tertiary text-small md:text-body">
                    Track revenue and manage payouts
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div
                  className="inline-flex items-center gap-1 rounded-full bg-surface-raised p-1"
                  role="group"
                  aria-label="Time range"
                >
                  {(["7d", "30d", "90d", "all"] as const).map((range) => (
                    <button
                      key={range}
                      type="button"
                      onClick={() => setTimeRange(range)}
                      aria-pressed={timeRange === range}
                      className={`min-h-11 px-3 py-1.5 rounded-full text-tiny font-semibold transition-colors ${
                        timeRange === range
                          ? "bg-[var(--wine)] text-text-primary"
                          : "text-text-secondary hover:text-text-primary"
                      }`}
                    >
                      {range === "all" ? "All" : range}
                    </button>
                  ))}
                </div>
                <Button variant="outline" size="md" onClick={handleExportCsv}>
                  <Download size={16} aria-hidden />
                  Export
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
                    <div className="text-small text-text-tertiary font-semibold mb-2 uppercase tracking-wide">
                      Available Balance
                    </div>
                    <div className="text-5xl font-bold tracking-tight mb-2 tabular-nums">
                      ${animatedAvailable.toFixed(2)}
                    </div>
                    <div className="text-small text-text-secondary">Ready to withdraw</div>
                  </div>
                  <div className="w-14 h-14 bg-success/10 rounded-2xl flex items-center justify-center">
                    <DollarSign size={28} className="text-success" />
                  </div>
                </div>

                <div
                  className="rounded-xl border border-border-base bg-surface-raised p-4 text-small text-text-secondary"
                  data-testid="alpha-payout-policy"
                >
                  <p className="font-semibold text-text-primary mb-1">Payouts during Alpha</p>
                  <p>
                    In-platform payments are not yet enabled, so there is nothing to withdraw yet.
                    When payments launch in Beta, Founding Creators keep{" "}
                    <strong className="text-text-primary">100% of their earnings</strong> (0%
                    platform commission) for the introductory period.
                  </p>
                </div>
              </div>
            </div>

            {/* Pending Payout */}
            <div className="bento-2x1 card-block p-4 md:p-8">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <div className="text-small text-text-tertiary font-semibold mb-2 uppercase tracking-wide">
                    Pending Payout
                  </div>
                  <div className="text-5xl font-bold tracking-tight mb-2 text-text-primary">
                    ${animatedPending.toFixed(2)}
                  </div>
                  <div className="flex items-center gap-2 text-small">
                    <Clock size={14} className="text-wine-text" />
                    <span className="text-text-secondary">
                      {pendingTransactions.length > 0 && pendingTransactions[0].available_on
                        ? `Estimated ${formatAvailableDate(pendingTransactions[0].available_on)}`
                        : "Processing"}
                    </span>
                  </div>
                </div>
                <div className="w-14 h-14 bg-brand-secondary/10 rounded-2xl flex items-center justify-center">
                  <Clock size={28} className="text-wine-text" />
                </div>
              </div>

              <div className="flex items-center gap-2 text-small text-text-tertiary">
                <CreditCard size={14} />
                <span>Payout methods open in Beta</span>
              </div>
            </div>
          </div>

          {/* Revenue Breakdown */}
          <div className="card-block p-4 md:p-8 mb-10">
            <div className="mb-6">
              <h3 className="text-lg font-bold mb-1 text-text-primary">Revenue Breakdown</h3>
              <p className="text-small text-text-tertiary">Earnings by source</p>
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
                description={`${tipPercent}% of total · net of fees`}
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

            {filteredTransactions.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-text-tertiary">No transactions yet</p>
              </div>
            ) : (
              <div className="divide-y divide-border-subtle">
                {filteredTransactions.map((transaction) => {
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
                            <div className="text-small text-text-tertiary">
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
                          <div className="text-tiny text-text-tertiary capitalize flex items-center gap-1 justify-end">
                            {transaction.status === "completed" ? (
                              <>
                                <CheckCircle size={12} className="text-success" />
                                <span>Completed</span>
                              </>
                            ) : (
                              <>
                                <Clock size={12} className="text-wine-text" />
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
        </StudioShell>
      </div>
    </PageShell>
  );
}
