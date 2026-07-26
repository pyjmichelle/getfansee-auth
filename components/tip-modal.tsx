"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { PLATFORM_TIP_FEE_BPS, computeTipPlatformFeeCents } from "@/lib/constants/fees";
import { DEFAULT_TIP_SETTINGS, type CreatorTipSettings } from "@/lib/tips";
import { useMediaQuery } from "@/hooks/use-mobile";
import { formatUsd } from "@/lib/format";

interface TipModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creatorId: string;
  creatorName?: string;
  postId?: string;
  /** Current fan wallet balance in cents — optional; shown for UX */
  balanceCents?: number;
  /** Called after a tip is successfully sent (e.g. to refresh goal/supporters). */
  onSuccess?: () => void;
}

function generateNonce() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const FEE_PERCENT = (PLATFORM_TIP_FEE_BPS / 100).toString();

export function TipModal({
  open,
  onOpenChange,
  creatorId,
  creatorName,
  postId,
  balanceCents,
  onSuccess,
}: TipModalProps) {
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
  const [customAmountStr, setCustomAmountStr] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [nonce, setNonce] = useState(generateNonce);
  const [settings, setSettings] = useState<CreatorTipSettings>(DEFAULT_TIP_SETTINGS);

  // This modal is rendered persistently on some pages (creator/[id], posts/[id])
  // with only `open` toggling — it never unmounts between tips. Without this,
  // the idempotency nonce from the FIRST tip would be reused on every
  // subsequent tip: the server correctly treats the repeat as a duplicate and
  // returns `idempotent: true` without charging again, but the UI still shows
  // "Tip sent!" — a silent no-op that looks like success. Regenerate on every
  // open, and reset the form so a stale amount/message doesn't linger.
  useEffect(() => {
    if (!open) return;
    setNonce(generateNonce());
    setSelectedPreset(null);
    setCustomAmountStr("");
    setMessage("");
  }, [open]);
  // Mobile: bottom sheet. Desktop: centered dialog — previously this modal
  // was Dialog-only, so on mobile it lacked the native bottom-sheet feel
  // used everywhere else in the app (F-004).
  const isMobile = useMediaQuery("(max-width: 767px)");

  // Lazy-load the creator's tip panel customization when the modal opens.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/creator/${creatorId}/tip-settings`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data?.settings) {
          setSettings(data.settings as CreatorTipSettings);
        }
      } catch {
        // fall back to defaults silently
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, creatorId]);

  const presets = settings.preset_amounts_cents?.length
    ? settings.preset_amounts_cents
    : DEFAULT_TIP_SETTINGS.preset_amounts_cents;
  const unitEmoji = settings.unit_emoji || DEFAULT_TIP_SETTINGS.unit_emoji;
  const unitLabel = settings.unit_label || DEFAULT_TIP_SETTINGS.unit_label;

  const resolvedAmountCents: number | null = (() => {
    if (selectedPreset !== null) return selectedPreset;
    const parsed = parseFloat(customAmountStr);
    if (!isNaN(parsed) && parsed > 0) return Math.round(parsed * 100);
    return null;
  })();

  const isInsufficient =
    balanceCents !== undefined &&
    resolvedAmountCents !== null &&
    resolvedAmountCents > balanceCents;

  const isValid =
    resolvedAmountCents !== null &&
    resolvedAmountCents >= 100 &&
    resolvedAmountCents <= 50_000 &&
    !isInsufficient;

  const feeCents =
    resolvedAmountCents !== null ? computeTipPlatformFeeCents(resolvedAmountCents) : 0;

  const handlePreset = (cents: number) => {
    setSelectedPreset(cents);
    setCustomAmountStr("");
  };

  const handleCustomChange = (val: string) => {
    setSelectedPreset(null);
    setCustomAmountStr(val);
  };

  const handleSubmit = async () => {
    if (!isValid || resolvedAmountCents === null) return;
    setLoading(true);

    try {
      const body: Record<string, unknown> = {
        creatorId,
        amountCents: resolvedAmountCents,
        clientNonce: nonce,
      };
      if (postId) body.postId = postId;
      if (message.trim()) body.message = message.trim().slice(0, 140);

      const res = await fetch("/api/tip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = (await res.json()) as {
        success: boolean;
        error?: string;
        thank_you_message?: string | null;
      };

      if (data.success) {
        const amountDisplay = `$${(resolvedAmountCents / 100).toFixed(2)}`;
        const thanks =
          data.thank_you_message?.trim() ||
          `Thank you for supporting ${creatorName ?? "this creator"}!`;
        toast.success(`Tip sent! ${amountDisplay} — ${thanks}`);
        onSuccess?.();
        onOpenChange(false);
      } else if (res.status === 402) {
        toast.error("Insufficient balance. Please add funds to your wallet.");
      } else {
        toast.error(data.error ?? "Tip failed. Please try again.");
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const titleContent = (
    <>
      <span aria-hidden className="text-xl leading-none">
        {unitEmoji}
      </span>
      Buy {creatorName ?? "this creator"} a {unitLabel}
    </>
  );
  const descriptionText = (
    <>
      A tip is a voluntary thank-you — not a purchase of any content, service, or reward. Tips are
      final and non-refundable. The platform retains a {FEE_PERCENT}% service fee; the rest goes to
      the creator&apos;s pending balance.
    </>
  );

  const body = (
    <>
      <div className="space-y-4 mt-2">
        {/* Preset amounts */}
        <div
          className={cn(
            "grid gap-2",
            presets.length <= 1 && "grid-cols-1",
            presets.length === 2 && "grid-cols-2",
            presets.length === 3 && "grid-cols-3",
            presets.length >= 4 && "grid-cols-4"
          )}
        >
          {presets.map((cents) => (
            <button
              key={cents}
              type="button"
              onClick={() => handlePreset(cents)}
              className={cn(
                "min-h-11 rounded-xl py-2.5 text-small font-semibold border transition-colors duration-100 active:scale-[0.98]",
                selectedPreset === cents
                  ? "bg-[var(--premium)]/20 border-[var(--premium)] text-[var(--premium)]"
                  : "border-border-base text-text-secondary hover:border-[var(--premium)]/50 hover:text-[var(--premium)]"
              )}
            >
              {cents % 100 === 0 ? `$${cents / 100}` : formatUsd(cents)}
            </button>
          ))}
        </div>

        {/* Custom amount */}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-small select-none">
            $
          </span>
          <Input
            type="number"
            min="1"
            max="500"
            step="1"
            placeholder="Custom amount"
            value={customAmountStr}
            onChange={(e) => handleCustomChange(e.target.value)}
            className="pl-7"
            aria-label="Custom tip amount in dollars"
          />
        </div>
        {resolvedAmountCents !== null && resolvedAmountCents < 100 && (
          <p className="text-tiny text-[var(--error-text)] -mt-2">Minimum tip is $1.00</p>
        )}
        {resolvedAmountCents !== null && resolvedAmountCents > 50_000 && (
          <p className="text-tiny text-[var(--error-text)] -mt-2">Maximum tip is $500.00</p>
        )}
        {isInsufficient && (
          <p className="text-tiny text-[var(--error-text)] -mt-2">
            Insufficient balance.{" "}
            <Link href="/me/wallet" className="underline hover:no-underline">
              Add funds
            </Link>
          </p>
        )}

        {/* Optional message */}
        <Textarea
          placeholder="Leave a message (optional, max 140 chars)"
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, 140))}
          rows={2}
          className="resize-none text-small"
          aria-label="Optional message for the creator"
        />
        <p className="text-tiny text-text-muted text-right -mt-2">{message.length}/140</p>

        {/* Fee breakdown */}
        {isValid && resolvedAmountCents !== null && (
          <div className="rounded-lg bg-surface-raised/60 border border-border-base px-3 py-2 text-tiny text-text-muted space-y-1">
            <div className="flex justify-between">
              <span>Your tip</span>
              <span>{formatUsd(resolvedAmountCents)}</span>
            </div>
            <div className="flex justify-between">
              <span>Platform service fee ({FEE_PERCENT}%)</span>
              <span>-{formatUsd(feeCents)}</span>
            </div>
            <div className="flex justify-between text-text-secondary font-medium">
              <span>Creator receives</span>
              <span>{formatUsd(resolvedAmountCents - feeCents)}</span>
            </div>
          </div>
        )}

        {/* Wallet hint */}
        {balanceCents !== undefined && (
          <p className="text-tiny text-text-muted">Wallet balance: {formatUsd(balanceCents)}</p>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 min-h-[44px]"
            disabled={!isValid || loading}
            loading={loading}
            onClick={handleSubmit}
          >
            {resolvedAmountCents ? `Tip ${formatUsd(resolvedAmountCents)}` : "Tip"}
          </Button>
        </div>
      </div>
    </>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto px-4">
          <SheetHeader className="px-0">
            <SheetTitle className="flex items-center gap-2">{titleContent}</SheetTitle>
            <SheetDescription>{descriptionText}</SheetDescription>
          </SheetHeader>
          {body}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-full max-w-sm sm:max-w-md rounded-2xl"
        aria-labelledby="tip-modal-title"
      >
        <DialogHeader>
          <DialogTitle id="tip-modal-title" className="flex items-center gap-2 text-lg">
            {titleContent}
          </DialogTitle>
          <DialogDescription className="text-text-muted text-small">
            {descriptionText}
          </DialogDescription>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
}
