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
import { ExternalLink, CheckCircle, Clock, X } from "@/lib/icons";

interface LinkItem {
  id: string;
  creator_id: string;
  creator_name: string;
  url: string;
  label: string;
  status: "pending" | "approved" | "rejected";
  click_count: number;
  rejection_reason: string | null;
  reviewed_at: string | null;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-warning/10 text-warning",
  approved: "bg-success/10 text-success",
  rejected: "bg-error/10 text-error",
};

export default function AdminCreatorLinksPage() {
  const router = useRouter();
  const auth = useAuth();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<LinkItem[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [statusFilter, setStatusFilter] = useState("pending");
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [isActing, setIsActing] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page_size: "50", status: statusFilter || "all" });
      const res = await fetch(`/api/admin/creator-links?${params}`);
      if (!res.ok) throw new Error("Failed to load");
      const json = await res.json();
      setItems(json.items ?? []);
      setTotal(json.total ?? 0);
      setCounts(json.counts ?? { pending: 0, approved: 0, rejected: 0 });
    } catch {
      toast.error("Failed to load links");
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

  const handleReview = async (id: string, action: "approve" | "reject", reason?: string) => {
    try {
      setIsActing(true);
      const res = await fetch(`/api/admin/creator-links/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(json?.error || "Failed");
      }
      toast.success(action === "approve" ? "Link approved" : "Link rejected");
      setRejectId(null);
      setRejectReason("");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Review failed");
    } finally {
      setIsActing(false);
    }
  };

  return (
    <div data-testid="admin-creator-links-page">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-h1 text-text-primary mb-1">External Link Reviews</h1>
        <p className="text-small text-text-tertiary">
          {total} records — creator profile links are only shown publicly after approval
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: "Pending", value: counts.pending, icon: Clock },
          { label: "Approved", value: counts.approved, icon: CheckCircle },
          { label: "Rejected", value: counts.rejected, icon: X },
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
          <div className="p-12 text-center text-text-tertiary text-small">No links found</div>
        ) : (
          <div className="divide-y divide-border-subtle">
            {items.map((item) => (
              <div key={item.id} className="p-4 md:p-6 hover:bg-surface-raised transition-colors">
                <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-6">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-small text-text-primary">
                        {item.label}
                      </span>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="text-tiny text-wine-text hover:underline inline-flex items-center gap-1 max-w-[320px] truncate"
                      >
                        <ExternalLink size={12} />
                        {item.url}
                      </a>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap text-tiny text-text-tertiary">
                      <span>Creator: {item.creator_name}</span>
                      <span>·</span>
                      <span>{format(new Date(item.created_at), "MMM d, yyyy")}</span>
                      {item.status === "approved" && (
                        <>
                          <span>·</span>
                          <span>{item.click_count} clicks</span>
                        </>
                      )}
                      {item.rejection_reason && (
                        <>
                          <span>·</span>
                          <span className="text-error">Reason: {item.rejection_reason}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <Badge
                    variant="outline"
                    className={`text-tiny shrink-0 ${STATUS_COLORS[item.status]}`}
                  >
                    {item.status}
                  </Badge>

                  {item.status === "pending" && (
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isActing}
                        className="text-tiny border-success/30 text-success hover:bg-success/10"
                        onClick={() => handleReview(item.id, "approve")}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isActing}
                        className="text-tiny border-error/30 text-error hover:bg-error/10"
                        onClick={() => setRejectId(item.id)}
                      >
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reject Dialog */}
      <AlertDialog open={!!rejectId} onOpenChange={(o) => !o && setRejectId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Link</AlertDialogTitle>
            <AlertDialogDescription>
              The creator will see the rejection reason in their link manager.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="reject-reason">Reason</Label>
            <Textarea
              id="reject-reason"
              placeholder="e.g. domain not allowed, misleading label…"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isActing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => rejectId && handleReview(rejectId, "reject", rejectReason)}
              disabled={isActing}
              className="bg-error text-white hover:bg-error/90"
            >
              {isActing ? "Processing…" : "Reject"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
