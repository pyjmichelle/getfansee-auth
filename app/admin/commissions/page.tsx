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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/auth-context";
import { DollarSign, CheckCircle, Clock, XCircle, RefreshCw } from "@/lib/icons";

interface Commission {
  id: string;
  attribution_id: string;
  referrer_user_id: string;
  referred_user_id: string;
  period_start: string;
  period_end: string;
  basis_revenue_cents: number;
  commission_percent: number;
  estimated_commission_amount_cents: number;
  approved_commission_amount_cents: number | null;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  status_reason: string | null;
  created_at: string;
}

function formatCents(cents: number | null): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-warning/10 text-warning",
  approved: "bg-success/10 text-success",
  rejected: "bg-error/10 text-error",
  voided: "bg-surface-raised text-text-tertiary",
};

const REJECT_REASONS = [
  { value: "refund", label: "Refund" },
  { value: "chargeback", label: "Chargeback" },
  { value: "risk_flag", label: "Risk / Fraud flag" },
  { value: "policy_violation", label: "Policy violation" },
  { value: "duplicate", label: "Duplicate attribution" },
  { value: "self_purchase", label: "Self-purchase" },
  { value: "other", label: "Other" },
];

export default function AdminCommissionsPage() {
  const router = useRouter();
  const auth = useAuth();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Commission[]>([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [actionId, setActionId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);
  const [note, setNote] = useState("");
  const [rejectReason, setRejectReason] = useState("other");
  const [isActing, setIsActing] = useState(false);
  const [isAccruing, setIsAccruing] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page_size: "50" });
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/admin/commissions?${params}`);
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      setItems(json.items ?? []);
      setTotal(json.total ?? 0);
    } catch {
      toast.error("Failed to load commissions");
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

  const openApprove = (id: string) => {
    setActionId(id);
    setActionType("approve");
    setNote("");
  };
  const openReject = (id: string) => {
    setActionId(id);
    setActionType("reject");
    setNote("");
    setRejectReason("other");
  };

  const handleAction = async () => {
    if (!actionId || !actionType) return;
    try {
      setIsActing(true);
      const endpoint = `/api/admin/commissions/${actionId}/${actionType}`;
      const body = actionType === "approve" ? { note } : { note, status_reason: rejectReason };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed");
      }
      toast.success(actionType === "approve" ? "Commission approved" : "Commission rejected");
      setActionId(null);
      setActionType(null);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setIsActing(false);
    }
  };

  const handleAccrue = async () => {
    try {
      setIsAccruing(true);
      const res = await fetch("/api/admin/commissions/accrue", { method: "POST" });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      toast.success(`Accrual complete. Created: ${json.created}, Skipped: ${json.skipped}`);
      load();
    } catch {
      toast.error("Accrual failed");
    } finally {
      setIsAccruing(false);
    }
  };

  const pendingTotal = items
    .filter((i) => i.status === "pending")
    .reduce((s, i) => s + (i.estimated_commission_amount_cents ?? 0), 0);
  const approvedTotal = items
    .filter((i) => i.status === "approved")
    .reduce((s, i) => s + (i.approved_commission_amount_cents ?? 0), 0);

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-h1 text-text-primary mb-1">Commission Review</h1>
          <p className="text-tiny text-text-tertiary">
            Estimated pending rewards only. Not withdrawable in MVP.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleAccrue}
          disabled={isAccruing}
          className="shrink-0 gap-2"
        >
          <RefreshCw size={14} />
          {isAccruing ? "Running…" : "Run Accrual"}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total rows", value: total, icon: DollarSign, secondary: "" },
          {
            label: "Pending",
            value: items.filter((i) => i.status === "pending").length,
            icon: Clock,
            secondary: `≈ ${formatCents(pendingTotal)}`,
          },
          {
            label: "Approved",
            value: items.filter((i) => i.status === "approved").length,
            icon: CheckCircle,
            secondary: formatCents(approvedTotal),
          },
          {
            label: "Rejected",
            value: items.filter((i) => i.status === "rejected").length,
            icon: XCircle,
            secondary: "",
          },
        ].map(({ label, value, icon: Icon, secondary }) => (
          <div key={label} className="card-block p-5 flex items-center gap-4">
            <div className="w-10 h-10 bg-surface-raised rounded-xl flex items-center justify-center shrink-0">
              <Icon size={20} className="text-text-tertiary" />
            </div>
            <div>
              <div className="text-tiny text-text-tertiary">{label}</div>
              <div className="text-2xl font-bold text-text-primary">{value}</div>
              {secondary && <div className="text-tiny text-text-tertiary mt-0.5">{secondary}</div>}
            </div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        {["pending", "approved", "rejected", ""].map((s) => (
          <button
            key={s || "all"}
            onClick={() => setStatusFilter(s)}
            className={`min-h-11 px-3 py-1.5 rounded-lg text-tiny font-medium transition-colors ${
              statusFilter === s
                ? "bg-[var(--wine)] text-white"
                : "bg-surface-raised text-text-secondary hover:bg-surface-overlay"
            }`}
          >
            {s || "All"}
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
          <div className="p-12 text-center text-text-tertiary text-small">No commissions found</div>
        ) : (
          <div className="divide-y divide-border-subtle">
            {items.map((item) => (
              <div key={item.id} className="p-4 md:p-6 hover:bg-surface-raised transition-colors">
                <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-6">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-small font-medium text-text-primary">
                        {formatCents(item.estimated_commission_amount_cents)}
                        <span className="text-tiny font-normal text-text-tertiary ml-1">
                          estimated
                        </span>
                      </span>
                      {item.approved_commission_amount_cents != null && (
                        <span className="text-small font-medium text-success">
                          {formatCents(item.approved_commission_amount_cents)}
                          <span className="text-tiny font-normal text-text-tertiary ml-1">
                            approved
                          </span>
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-tiny text-text-tertiary flex-wrap">
                      <span>
                        Basis: {formatCents(item.basis_revenue_cents)} × {item.commission_percent}%
                      </span>
                      <span>
                        {format(new Date(item.period_start), "MMM d")} –{" "}
                        {format(new Date(item.period_end), "MMM d, yyyy")}
                      </span>
                      <span className="font-mono truncate max-w-[120px]">
                        Ref: {item.referrer_user_id.slice(0, 10)}…
                      </span>
                    </div>
                    {item.review_note && (
                      <div className="text-tiny text-text-tertiary italic">
                        Note: {item.review_note}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      variant="outline"
                      className={`text-tiny ${STATUS_COLORS[item.status] ?? "bg-surface-raised text-text-secondary"}`}
                    >
                      {item.status}
                    </Badge>
                    {item.status === "pending" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-tiny border-success/30 text-success hover:bg-success/10"
                          onClick={() => openApprove(item.id)}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-tiny border-error/30 text-error hover:bg-error/10"
                          onClick={() => openReject(item.id)}
                        >
                          Reject
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action Dialog */}
      <AlertDialog open={!!actionId} onOpenChange={(o) => !o && setActionId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionType === "approve" ? "Approve Commission" : "Reject Commission"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionType === "approve"
                ? "This sets the approved amount equal to the estimated amount. The creator will see it as an approved pending record — not withdrawable in MVP."
                : "This marks the commission as rejected. The referrer will not receive a reward for this period."}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 py-2">
            {actionType === "reject" && (
              <div className="space-y-2">
                <Label>Rejection reason</Label>
                <Select value={rejectReason} onValueChange={setRejectReason}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REJECT_REASONS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="action-note">Review note (optional)</Label>
              <Textarea
                id="action-note"
                placeholder="Internal note for audit trail…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isActing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAction}
              disabled={isActing}
              className={
                actionType === "approve"
                  ? "bg-success text-white hover:bg-success/90"
                  : "bg-error text-white hover:bg-error/90"
              }
            >
              {isActing ? "Processing…" : actionType === "approve" ? "Approve" : "Reject"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
