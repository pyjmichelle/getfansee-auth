"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Wallet, X } from "@/lib/icons";
import { toast } from "sonner";

interface PayramConfig {
  enabled: boolean;
  reason: string | null;
  tiers: number[];
  onrampFeePercentRange: [number, number];
}

/**
 * Crypto top-up.
 *
 * Two things this deliberately makes visible rather than hiding:
 *
 *   1. The fan pays more than the tier. The card-to-crypto step is run by a
 *      third party who bills them directly — roughly 3–5% on top. We never
 *      touch that money, but a fan who discovers it on the payment page has
 *      been ambushed, so the estimate is on the button.
 *   2. The balance is closed-loop. Spendable here, not withdrawable. That
 *      restriction is only defensible if it is stated where the money goes in,
 *      not only in the Terms.
 *
 * Amounts are fixed tiers because the onramp minimum is around $20 while a PPV
 * post is $1.99 — per-item card payment is arithmetically impossible on this
 * rail, so the model is prepay-then-spend.
 */
export function PayramTopupModal({ onClose }: { onClose: () => void }) {
  const [config, setConfig] = useState<PayramConfig | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/payments/payram/config")
      .then((r) => r.json())
      .then((data: PayramConfig) => {
        if (!cancelled) setConfig(data);
      })
      .catch(() => {
        if (!cancelled)
          setConfig({ enabled: false, reason: "error", tiers: [], onrampFeePercentRange: [3, 5] });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/payments/payram/create-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountUsd: selected }),
      });
      const result = await res.json();

      if (!res.ok || !result.success || !result.url) {
        toast.error(result.error || "Could not start the payment. Please try again.");
        setSubmitting(false);
        return;
      }

      // Full navigation, not a popup: the hosted page handles a card flow that
      // frequently needs 3-D Secure, and popups get blocked or lost.
      window.location.href = result.url;
    } catch {
      toast.error("Could not start the payment. Please try again.");
      setSubmitting(false);
    }
  };

  const feeLow = config?.onrampFeePercentRange?.[0] ?? 3;
  const feeHigh = config?.onrampFeePercentRange?.[1] ?? 5;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[var(--z-modal)] flex items-center justify-center p-4">
      <div
        className="bg-surface-base border border-border-default rounded-2xl max-w-md w-full shadow-2xl"
        data-testid="payram-topup-modal"
      >
        <div className="p-6 border-b border-border-default flex items-center justify-between">
          <h3 className="text-h4 font-bold text-text-primary">Add Funds</h3>
          <Button
            onClick={onClose}
            variant="ghost"
            size="icon"
            className="w-10 h-10 rounded-xl hover:bg-surface-raised"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {config === null ? (
          <div className="p-6 text-small text-text-secondary">Loading…</div>
        ) : !config.enabled ? (
          <div className="p-6" data-testid="payram-unavailable">
            <div className="w-14 h-14 bg-[var(--wine-tint)] rounded-2xl flex items-center justify-center mb-4">
              <Wallet className="w-7 h-7 text-wine-text" />
            </div>
            <h4 className="text-h4 font-bold text-text-primary mb-2">
              {config.reason === "region_not_supported"
                ? "Top-ups are not available in your region yet"
                : "Wallet top-ups are coming soon"}
            </h4>
            <p className="text-small text-text-secondary mb-6">
              {config.reason === "region_not_supported"
                ? "You can keep discovering and following creators for free, and support them through the verified links on their profiles."
                : "In-platform purchases are not enabled yet. You can still discover and follow creators for free."}
            </p>
            <Button onClick={onClose} className="w-full">
              Got it
            </Button>
          </div>
        ) : (
          <div className="p-6">
            <label className="block text-small font-semibold mb-3 text-text-secondary">
              Select an amount
            </label>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {config.tiers.map((amt) => (
                <Button
                  key={amt}
                  onClick={() => setSelected(amt)}
                  data-testid={`payram-tier-${amt}`}
                  variant="outline"
                  size="lg"
                  className={`h-auto py-4 rounded-xl border-2 ${
                    selected === amt
                      ? "border-[var(--wine)] bg-[var(--wine-tint)] text-wine-text"
                      : "border-border-default hover:border-[var(--border-wine)]"
                  }`}
                >
                  <span className="text-h3 font-bold">${amt}</span>
                </Button>
              ))}
            </div>

            <div className="mb-6 p-4 rounded-xl bg-surface-raised border border-border-subtle">
              <p className="text-small text-text-secondary">
                You pay by card and the amount is converted to USDC. The conversion is handled by a
                third-party provider who charges you{" "}
                <strong className="text-text-primary">
                  about {feeLow}–{feeHigh}% on top
                </strong>{" "}
                — so a ${selected ?? config.tiers[0]} top-up costs roughly $
                {Math.ceil((selected ?? config.tiers[0]) * (1 + feeHigh / 100))}. GetFanSee does not
                receive that fee.
              </p>
              <p className="text-tiny text-text-muted mt-3">
                Wallet balance is spendable on GetFanSee only — not withdrawable or transferable.{" "}
                <Link href="/terms#payments" className="underline hover:no-underline">
                  Details
                </Link>
              </p>
            </div>

            <div className="space-y-3">
              <Button
                disabled={!selected || submitting}
                loading={submitting}
                onClick={handleSubmit}
                data-testid="payram-submit"
                size="lg"
                className="w-full"
              >
                {selected ? `Continue with $${selected}` : "Select an amount"}
              </Button>
              <Button variant="outline" size="lg" onClick={onClose} className="w-full">
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
