"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, DollarSign, TrendingUp, Calendar, Download, Clock } from "lucide-react";
import { NavHeader } from "@/components/nav-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { ensureProfile } from "@/lib/auth";
import { getProfile } from "@/lib/profile";
// getCreatorEarnings 通过 API 调用，不直接导入
import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";

const supabase = getSupabaseBrowserClient();

interface Transaction {
  id: string;
  type: string;
  amount_cents: number;
  status: string;
  available_on: string | null;
  metadata: any;
  created_at: string;
}

export default function EarningsPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d" | "all">("30d");
  const [currentUser, setCurrentUser] = useState<{
    username: string;
    role: "fan" | "creator";
    avatar?: string;
  } | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

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

  const platformFee = totalEarnings * 0.2;
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
      default:
        return type;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "subscription":
        return (
          <Badge className="bg-[#6366F1]/10 text-[#6366F1] border-[#6366F1]/20 rounded-lg">
            Subscription
          </Badge>
        );
      case "ppv_purchase":
        return (
          <Badge className="bg-[#A855F7]/10 text-[#A855F7] border-[#A855F7]/20 rounded-lg">
            PPV
          </Badge>
        );
      case "commission":
        return (
          <Badge className="bg-green-500/10 text-green-600 dark:text-green-400 border-[#10B981]/20 rounded-lg">
            Commission
          </Badge>
        );
      default:
        return <Badge className="bg-muted text-muted-foreground rounded-lg">{type}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        {currentUser && <NavHeader user={currentUser} notificationCount={0} />}
        <main className="container max-w-6xl mx-auto px-4 py-6">
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-[#121212] rounded-3xl"></div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {currentUser && <NavHeader user={currentUser} notificationCount={0} />}

      <main className="container max-w-6xl mx-auto px-4 md:px-8 py-8 md:py-12">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="mb-6 border-border bg-card hover:bg-[#1A1A1A] rounded-xl"
        >
          <Link href="/creator/studio">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Studio
          </Link>
        </Button>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Earnings</h1>
            <p className="text-muted-foreground">Track your revenue and payouts</p>
          </div>
          <Button variant="outline" className="bg-card border-border hover:bg-[#1A1A1A] rounded-xl">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>

        {/* Time Range Filter */}
        <div className="flex gap-2 mb-6">
          <Button
            variant={timeRange === "7d" ? "default" : "outline"}
            size="sm"
            onClick={() => setTimeRange("7d")}
            className={`rounded-xl ${
              timeRange === "7d"
                ? "bg-primary-gradient"
                : "border-border bg-card hover:bg-[#1A1A1A]"
            }`}
          >
            7 Days
          </Button>
          <Button
            variant={timeRange === "30d" ? "default" : "outline"}
            size="sm"
            onClick={() => setTimeRange("30d")}
            className={`rounded-xl ${
              timeRange === "30d"
                ? "bg-primary-gradient"
                : "border-border bg-card hover:bg-[#1A1A1A]"
            }`}
          >
            30 Days
          </Button>
          <Button
            variant={timeRange === "90d" ? "default" : "outline"}
            size="sm"
            onClick={() => setTimeRange("90d")}
            className={`rounded-xl ${
              timeRange === "90d"
                ? "bg-primary-gradient"
                : "border-border bg-card hover:bg-[#1A1A1A]"
            }`}
          >
            90 Days
          </Button>
          <Button
            variant={timeRange === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setTimeRange("all")}
            className={`rounded-xl ${
              timeRange === "all"
                ? "bg-primary-gradient"
                : "border-border bg-card hover:bg-[#1A1A1A]"
            }`}
          >
            All Time
          </Button>
        </div>

        {/* Earnings Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
          <div className="bg-card border border-border rounded-3xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 text-green-600 dark:text-green-400 flex items-center justify-center">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">${totalEarnings.toFixed(2)}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Total Earnings</p>
          </div>

          <div className="bg-card border border-border rounded-3xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-[#6366F1]/10 text-[#6366F1] flex items-center justify-center">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">${availableBalance.toFixed(2)}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Available Balance</p>
          </div>

          <div className="bg-card border border-border rounded-3xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-[#F59E0B]/10 text-[#F59E0B] flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">${pendingBalance.toFixed(2)}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Pending Balance</p>
          </div>

          <div className="bg-card border border-border rounded-3xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-muted text-muted-foreground flex items-center justify-center">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">${platformFee.toFixed(2)}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Platform Fee (20%)</p>
          </div>
        </div>

        {/* Next Payout */}
        {pendingBalance > 0 && (
          <div className="bg-card border border-[#6366F1]/20 rounded-3xl p-6 mb-8 bg-[#6366F1]/5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-foreground mb-1">Pending Settlement</h3>
                <p className="text-sm text-muted-foreground">
                  {pendingTransactions.length > 0 && pendingTransactions[0].available_on
                    ? `Available on ${formatAvailableDate(pendingTransactions[0].available_on)}`
                    : "Settlement date will be calculated"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-foreground">${pendingBalance.toFixed(2)}</p>
                <p className="text-sm text-muted-foreground">Pending balance</p>
              </div>
            </div>
          </div>
        )}

        {/* Transaction History */}
        <div className="bg-card border border-border rounded-3xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Transaction History</h2>
          {transactions.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No transactions yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((transaction) => {
                const amount = transaction.amount_cents / 100;
                const afterFee = amount * 0.8;

                return (
                  <div
                    key={transaction.id}
                    className="flex items-center gap-4 p-4 bg-[#121212] rounded-xl hover:bg-[#1A1A1A] transition-colors"
                  >
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        transaction.status === "completed"
                          ? "bg-green-500/10 text-green-600 dark:text-green-400"
                          : "bg-[#F59E0B]/10 text-[#F59E0B]"
                      }`}
                    >
                      <DollarSign className="w-5 h-5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {getTypeBadge(transaction.type)}
                        <Badge
                          variant={transaction.status === "completed" ? "default" : "secondary"}
                          className="text-xs rounded-lg"
                        >
                          {transaction.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span>{getTypeLabel(transaction.type)}</span>
                        <span>•</span>
                        <span>{formatDate(transaction.created_at)}</span>
                        {transaction.available_on && transaction.status === "pending" && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Available {formatAvailableDate(transaction.available_on)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-lg font-bold text-foreground">+${amount.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">
                        ${afterFee.toFixed(2)} after fee
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
