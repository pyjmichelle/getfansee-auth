"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Wallet } from "@/lib/icons";
import { useAuth } from "@/contexts/auth-context";
import { useSkeletonMetric } from "@/hooks/use-skeleton-metric";

interface WithdrawalRow {
  id: string;
  creator_id: string;
  amount_cents: number;
  status: string;
  created_at: string;
  method?: {
    rail: string;
    destination: string;
    label: string | null;
  } | null;
}

export default function AdminWithdrawalsPage() {
  const router = useRouter();
  const auth = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [rows, setRows] = useState<WithdrawalRow[]>([]);
  const [actingId, setActingId] = useState<string | null>(null);
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");
  useSkeletonMetric("admin_withdrawals_page", isLoading);

  const load = async () => {
    const res = await fetch("/api/admin/withdrawals");
    if (res.ok) {
      const data = await res.json();
      setRows(data.withdrawals || []);
    }
  };

  useEffect(() => {
    const run = async () => {
      if (!auth.authenticated || !auth.user) {
        router.push("/auth");
        return;
      }
      if (auth.profile?.role !== "admin") {
        router.push("/home");
        return;
      }
      try {
        await load();
      } finally {
        setIsLoading(false);
      }
    };
    void run();
  }, [router, auth.authenticated, auth.user, auth.profile]);

  const decide = async (requestId: string, decision: "paid" | "rejected") => {
    if (!reason.trim()) {
      toast.error("Add a reason — it is the audit trail.");
      return;
    }
    if (decision === "paid" && !reference.trim()) {
      toast.error("Paste the off-platform transfer id before marking paid.");
      return;
    }
    setActingId(requestId);
    try {
      const res = await fetch("/api/admin/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId,
          decision,
          externalReference: reference.trim(),
          reason: reason.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || "Could not update the withdrawal");
        return;
      }
      toast.success(decision === "paid" ? "Marked paid" : "Rejected and refunded to wallet");
      setReference("");
      setReason("");
      await load();
    } finally {
      setActingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4 max-w-6xl">
        <div className="h-8 bg-surface-raised rounded-xl w-48" />
        <div className="h-40 bg-surface-raised rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="card-block bg-gradient-subtle p-6 md:p-8 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-[var(--wine)]/10 rounded-xl flex items-center justify-center">
            <Wallet className="w-6 h-6 text-wine-text" />
          </div>
          <div>
            <h1 className="text-h1 font-bold text-text-primary">Withdrawals</h1>
            <p className="text-text-secondary">
              Review creator withdrawal requests. Paying records the off-platform transfer; the
              wallet was already debited when the creator asked.
            </p>
          </div>
        </div>
      </div>

      <div className="card-block p-6 mb-6 space-y-3">
        <Label htmlFor="payout-reference">Off-platform transfer id</Label>
        <Input
          id="payout-reference"
          data-testid="admin-payout-reference"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="tx hash or Paxum reference"
        />
        <Label htmlFor="payout-reason">Reason</Label>
        <Textarea
          id="payout-reason"
          data-testid="admin-payout-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Approved after matching the on-chain transfer"
        />
      </div>

      {rows.length === 0 ? (
        <div className="card-block p-8 text-center text-text-secondary">No pending withdrawals</div>
      ) : (
        <div className="space-y-4">
          {rows.map((row) => (
            <div key={row.id} className="card-block p-6" data-testid={`admin-withdrawal-${row.id}`}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <p className="text-h4 font-bold text-text-primary">
                    ${(row.amount_cents / 100).toFixed(2)}
                  </p>
                  <p className="text-small text-text-secondary">
                    {row.method?.rail ?? "unknown rail"} ·{" "}
                    {row.method?.destination ?? "no destination"}
                  </p>
                  <p className="text-tiny text-text-muted">
                    {row.creator_id} · {new Date(row.created_at).toLocaleString("en-US")}
                  </p>
                </div>
                <div className="flex gap-3">
                  <Button
                    onClick={() => decide(row.id, "paid")}
                    disabled={actingId === row.id}
                    loading={actingId === row.id}
                  >
                    Mark paid
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => decide(row.id, "rejected")}
                    disabled={actingId === row.id}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
