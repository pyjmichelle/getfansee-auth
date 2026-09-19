"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wallet, Plus, Clock } from "@/lib/icons";
import { toast } from "sonner";

interface PayoutMethod {
  id: string;
  rail: "payram_crypto" | "paxum";
  destination: string;
  label: string | null;
  is_default: boolean;
}

interface WithdrawalRow {
  id: string;
  amount_cents: number;
  status: string;
  created_at: string;
  reason: string | null;
}

function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function CreatorPayoutPanel() {
  const [paymentsLive, setPaymentsLive] = useState(false);
  const [minimumCents, setMinimumCents] = useState(2000);
  const [availableCents, setAvailableCents] = useState(0);
  const [methods, setMethods] = useState<PayoutMethod[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingMethod, setSavingMethod] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [rail, setRail] = useState<"payram_crypto" | "paxum">("payram_crypto");
  const [destination, setDestination] = useState("");
  const [label, setLabel] = useState("");
  const [amountUsd, setAmountUsd] = useState("");
  const [methodId, setMethodId] = useState<string>("");

  const reload = useCallback(async () => {
    const [methodsRes, withdrawalsRes] = await Promise.all([
      fetch("/api/creator/payout-methods"),
      fetch("/api/creator/withdrawals"),
    ]);
    if (methodsRes.ok) {
      const data = await methodsRes.json();
      setPaymentsLive(data.paymentsLive === true);
      setMinimumCents(data.minimumCents ?? 2000);
      setAvailableCents(data.availableCents ?? 0);
      const nextMethods = (data.methods ?? []) as PayoutMethod[];
      setMethods(nextMethods);
      setMethodId(
        (current) =>
          current || nextMethods.find((m) => m.is_default)?.id || nextMethods[0]?.id || ""
      );
    }
    if (withdrawalsRes.ok) {
      const data = await withdrawalsRes.json();
      setWithdrawals((data.withdrawals ?? []) as WithdrawalRow[]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    reload()
      .catch(() => {
        if (!cancelled) toast.error("Could not load payout settings");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const handleAddMethod = async () => {
    setSavingMethod(true);
    try {
      const res = await fetch("/api/creator/payout-methods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rail, destination, label: label || null }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || "Could not save the payout method");
        return;
      }
      toast.success("Payout method saved");
      setDestination("");
      setLabel("");
      await reload();
    } finally {
      setSavingMethod(false);
    }
  };

  const handleWithdraw = async () => {
    const dollars = Number(amountUsd);
    if (!Number.isFinite(dollars) || dollars <= 0) {
      toast.error("Enter a withdrawal amount");
      return;
    }
    if (!methodId) {
      toast.error("Add a payout method first");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/creator/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ methodId, amountCents: Math.round(dollars * 100) }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || "Withdrawal failed");
        return;
      }
      toast.success("Withdrawal requested. An admin will send it off-platform.");
      setAmountUsd("");
      await reload();
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <p className="text-small text-text-secondary">Loading payout settings…</p>;
  }

  if (!paymentsLive) {
    return (
      <div data-testid="alpha-payout-policy">
        <p className="font-semibold text-text-primary mb-1">Payouts during Alpha</p>
        <p>
          In-platform payments are not yet enabled, so there is nothing to withdraw yet. When
          payments launch, Founding Creators keep{" "}
          <strong className="text-text-primary">100% of their earnings</strong> (0% platform
          commission) for the introductory period.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="creator-payout-panel">
      <div>
        <p className="text-small text-text-secondary mb-3">
          Wallet available:{" "}
          <strong className="text-text-primary">{formatUsd(availableCents)}</strong>. Minimum
          withdrawal {formatUsd(minimumCents)}. Transfers are reviewed and sent off-platform.
        </p>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] items-end">
          <div>
            <Label htmlFor="withdraw-amount">Amount (USD)</Label>
            <Input
              id="withdraw-amount"
              data-testid="withdraw-amount"
              type="number"
              min={minimumCents / 100}
              step="0.01"
              value={amountUsd}
              onChange={(e) => setAmountUsd(e.target.value)}
              className="mt-2"
            />
          </div>
          <Button
            size="lg"
            disabled={submitting || methods.length === 0}
            loading={submitting}
            onClick={handleWithdraw}
            data-testid="withdraw-submit"
          >
            Request withdrawal
          </Button>
        </div>
        {methods.length > 1 && (
          <div className="mt-3">
            <Label htmlFor="withdraw-method">Payout method</Label>
            <select
              id="withdraw-method"
              className="mt-2 w-full min-h-11 rounded-xl border border-border-default bg-surface-base px-3 text-small"
              value={methodId}
              onChange={(e) => setMethodId(e.target.value)}
            >
              {methods.map((method) => (
                <option key={method.id} value={method.id}>
                  {method.label || method.rail} · {method.destination}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border-subtle p-4 space-y-3">
        <div className="flex items-center gap-2 text-text-primary font-semibold">
          <Wallet className="w-4 h-4" />
          Payout methods
        </div>
        {methods.length === 0 ? (
          <p className="text-small text-text-secondary">Add a destination before withdrawing.</p>
        ) : (
          <ul className="space-y-2">
            {methods.map((method) => (
              <li key={method.id} className="text-small text-text-secondary">
                {method.rail === "payram_crypto" ? "USDC on Base" : "Paxum"} · {method.destination}
                {method.is_default ? " · default" : ""}
              </li>
            ))}
          </ul>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="payout-rail">Rail</Label>
            <select
              id="payout-rail"
              className="mt-2 w-full min-h-11 rounded-xl border border-border-default bg-surface-base px-3 text-small"
              value={rail}
              onChange={(e) => setRail(e.target.value as "payram_crypto" | "paxum")}
            >
              <option value="payram_crypto">USDC wallet (Base)</option>
              <option value="paxum">Paxum email</option>
            </select>
          </div>
          <div>
            <Label htmlFor="payout-label">Label</Label>
            <Input
              id="payout-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="mt-2"
              placeholder="Main wallet"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="payout-destination">
            {rail === "payram_crypto" ? "Wallet address" : "Paxum email"}
          </Label>
          <Input
            id="payout-destination"
            data-testid="payout-destination"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            className="mt-2"
            placeholder={rail === "payram_crypto" ? "0x…" : "you@example.com"}
          />
        </div>
        <Button
          variant="outline"
          onClick={handleAddMethod}
          disabled={savingMethod || !destination.trim()}
          loading={savingMethod}
        >
          <Plus className="w-4 h-4" />
          Save method
        </Button>
      </div>

      {withdrawals.length > 0 && (
        <div>
          <p className="font-semibold text-text-primary mb-3">Withdrawal history</p>
          <ul className="space-y-2">
            {withdrawals.map((row) => (
              <li
                key={row.id}
                className="flex items-center justify-between text-small text-text-secondary"
              >
                <span>
                  {formatUsd(row.amount_cents)} · {row.status}
                </span>
                <span className="flex items-center gap-1 text-tiny text-text-muted">
                  <Clock className="w-3 h-3" />
                  {new Date(row.created_at).toLocaleDateString("en-US")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
