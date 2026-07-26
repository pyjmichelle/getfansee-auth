"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/auth-context";
import { Users, AlertTriangle, CheckCircle, Clock } from "@/lib/icons";

interface Attribution {
  id: string;
  referrer_user_id: string;
  referred_user_id: string;
  referral_code: string;
  source: string;
  status: string;
  qualified_at: string | null;
  risk_flags: string[];
  is_fraud: boolean;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  signup_completed: "bg-surface-raised text-text-secondary",
  creator_role_selected: "bg-brand-secondary/10 text-wine-text",
  kyc_verified: "bg-[var(--wine)]/10 text-wine-text",
  qualified: "bg-success/10 text-success",
  revenue_eligible: "bg-success/20 text-success",
  rejected: "bg-error/10 text-error",
  fraud: "bg-error/20 text-error",
};

export default function AdminReferralsPage() {
  const router = useRouter();
  const auth = useAuth();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Attribution[]>([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [fraudId, setFraudId] = useState<string | null>(null);
  const [fraudReason, setFraudReason] = useState("");
  const [isActing, setIsActing] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page_size: "50" });
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/admin/referrals?${params}`);
      if (!res.ok) throw new Error("Failed to load");
      const json = await res.json();
      setItems(json.items ?? []);
      setTotal(json.total ?? 0);
    } catch {
      toast.error("Failed to load referrals");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    if (!auth.authenticated) {
      router.push("/auth");
    } else if (auth.profile?.role !== "admin") {
      router.push("/home");
    } else {
      load();
    }
  }, [router, load, auth.authenticated, auth.profile]);

  const handleMarkFraud = async () => {
    if (!fraudId) return;
    try {
      setIsActing(true);
      const res = await fetch(`/api/admin/referrals/${fraudId}/fraud`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: fraudReason }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Marked as fraud and pending commissions voided");
      setFraudId(null);
      setFraudReason("");
      load();
    } catch {
      toast.error("Failed to mark fraud");
    } finally {
      setIsActing(false);
    }
  };

  const STATUSES = [
    "signup_completed",
    "creator_role_selected",
    "kyc_verified",
    "qualified",
    "revenue_eligible",
    "rejected",
    "fraud",
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-h1 text-text-primary mb-1">Referral Attributions</h1>
        <p className="text-small text-text-tertiary">{total} total records</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total", value: total, icon: Users },
          {
            label: "Qualified",
            value: items.filter((i) => ["qualified", "revenue_eligible"].includes(i.status)).length,
            icon: CheckCircle,
          },
          {
            label: "Pending KYC",
            value: items.filter((i) => i.status === "kyc_verified").length,
            icon: Clock,
          },
          {
            label: "Flagged",
            value: items.filter((i) => i.risk_flags?.length > 0 || i.is_fraud).length,
            icon: AlertTriangle,
          },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="card-block p-5 flex items-center gap-4">
            <div className="w-10 h-10 bg-surface-raised rounded-xl flex items-center justify-center shrink-0">
              <Icon size={20} className="text-text-tertiary" />
            </div>
            <div>
              <div className="text-tiny text-text-tertiary">{label}</div>
              <div className="text-2xl font-bold text-text-primary">{value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setStatusFilter("")}
          className={`min-h-11 px-3 py-1.5 rounded-lg text-tiny font-medium transition-colors ${
            !statusFilter
              ? "bg-[var(--wine)] text-white"
              : "bg-surface-raised text-text-secondary hover:bg-surface-overlay"
          }`}
        >
          All
        </button>
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`min-h-11 px-3 py-1.5 rounded-lg text-tiny font-medium transition-colors ${
              statusFilter === s
                ? "bg-[var(--wine)] text-white"
                : "bg-surface-raised text-text-secondary hover:bg-surface-overlay"
            }`}
          >
            {s.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card-block overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-4 animate-pulse">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-14 bg-surface-raised rounded" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-text-tertiary text-small">No referrals found</div>
        ) : (
          <div className="divide-y divide-border-subtle">
            {items.map((item) => (
              <div key={item.id} className="p-4 md:p-6 hover:bg-surface-raised transition-colors">
                <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-6">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-tiny font-mono text-text-tertiary truncate max-w-[180px]">
                        Referrer: {item.referrer_user_id.slice(0, 12)}…
                      </span>
                      <span className="text-tiny text-text-tertiary">→</span>
                      <span className="text-tiny font-mono text-text-tertiary truncate max-w-[180px]">
                        {item.referred_user_id.slice(0, 12)}…
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-tiny text-text-tertiary">
                        Code: <span className="font-mono">{item.referral_code}</span>
                      </span>
                      <span className="text-tiny text-text-tertiary">
                        {format(new Date(item.created_at), "MMM d, yyyy")}
                      </span>
                      {item.qualified_at && (
                        <span className="text-tiny text-success">
                          Qualified {format(new Date(item.qualified_at), "MMM d")}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      variant="outline"
                      className={`text-tiny ${STATUS_COLORS[item.status] ?? "bg-surface-raised text-text-secondary"}`}
                    >
                      {item.status.replace(/_/g, " ")}
                    </Badge>
                    {item.risk_flags?.map((f) => (
                      <Badge
                        key={f}
                        variant="outline"
                        className="text-tiny bg-warning/10 text-warning border-transparent"
                      >
                        {f}
                      </Badge>
                    ))}
                    {item.is_fraud && (
                      <Badge
                        variant="outline"
                        className="text-tiny bg-error/20 text-error border-transparent"
                      >
                        FRAUD
                      </Badge>
                    )}
                  </div>

                  {!item.is_fraud && item.status !== "rejected" && item.status !== "fraud" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 text-tiny border-error/30 text-error hover:bg-error/10"
                      onClick={() => setFraudId(item.id)}
                    >
                      Mark Fraud
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Mark Fraud Dialog */}
      <AlertDialog open={!!fraudId} onOpenChange={(o) => !o && setFraudId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark as Fraud / Rejected</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the attribution as fraud and void all pending commissions. This action
              is logged.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="fraud-reason">Reason (optional)</Label>
            <Textarea
              id="fraud-reason"
              placeholder="e.g. duplicate account, self-referral via alias…"
              value={fraudReason}
              onChange={(e) => setFraudReason(e.target.value)}
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isActing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleMarkFraud}
              disabled={isActing}
              className="bg-error text-white hover:bg-error/90"
            >
              {isActing ? "Processing…" : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
