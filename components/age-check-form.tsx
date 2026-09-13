"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ShieldAlert, Camera, UserCheck } from "@/lib/icons";
import type { AccessTier } from "@/lib/compliance/jurisdictions";

type VendorMethod = "age_estimation" | "document";

interface AgeCheckFormProps {
  tier: Exclude<AccessTier, "blocked">;
  /** Florida: facial estimation must be offered as a standalone anonymous option. */
  allowAnonymousOption: boolean;
  next: string;
  initialStatus: string | null;
}

const STATUS_MESSAGES: Record<string, string> = {
  declined: "We could not confirm that you are over 18. You can try again with another method.",
  in_review:
    "Your verification is still being reviewed. This usually takes a few minutes — try again shortly.",
  insufficient:
    "The check you completed does not meet the requirements for your current location. Please verify with a photo ID.",
  unavailable: "Verification is temporarily unavailable. Please try again later.",
  invalid: "That verification link was not valid. Please start again.",
};

export function AgeCheckForm({
  tier,
  allowAnonymousOption,
  next,
  initialStatus,
}: AgeCheckFormProps) {
  const [pendingMethod, setPendingMethod] = useState<VendorMethod | null>(null);
  const [error, setError] = useState<string | null>(
    initialStatus ? (STATUS_MESSAGES[initialStatus] ?? null) : null
  );

  const offerEstimation = tier === "age_estimation" || allowAnonymousOption;
  const offerDocument = tier === "document";

  async function start(method: VendorMethod) {
    setPendingMethod(method);
    setError(null);
    try {
      const res = await fetch("/api/age-assurance/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method, next }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error ?? "Could not start verification. Please try again.");
        setPendingMethod(null);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Network error. Please check your connection and try again.");
      setPendingMethod(null);
    }
  }

  return (
    <div className="card-block max-w-md w-full p-6 space-y-5" data-testid="age-check-form">
      <div className="flex flex-col items-center text-center gap-3">
        <div className="size-12 rounded-full bg-[var(--wine)]/15 border border-[var(--wine)]/20 flex items-center justify-center">
          <ShieldAlert className="size-5 text-wine-text" aria-hidden="true" />
        </div>
        <h1 className="text-h2 font-semibold text-text-primary">Verify your age</h1>
        <p className="text-body text-text-secondary">
          {tier === "document"
            ? "The law where you are requires us to verify that you are over 18 before showing adult content."
            : "Regulations where you are require a real age check before we can show adult content."}
        </p>
      </div>

      {error && (
        <p
          className="text-small text-[var(--error-text)] text-center"
          role="alert"
          data-testid="age-check-error"
        >
          {error}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {offerEstimation && (
          <div className="space-y-2">
            <Button
              size="lg"
              className="w-full"
              onClick={() => void start("age_estimation")}
              disabled={pendingMethod !== null}
              data-testid="age-check-estimation"
            >
              <Camera className="size-4" aria-hidden="true" />
              {pendingMethod === "age_estimation" ? "Opening…" : "Estimate my age from a selfie"}
            </Button>
            <p className="text-tiny text-text-muted text-center">
              Anonymous. Predicts an age range from your face — it does not identify you, and no
              photo or document is stored by GetFanSee.
            </p>
          </div>
        )}

        {offerDocument && (
          <div className="space-y-2">
            <Button
              size="lg"
              variant={offerEstimation ? "outline" : "default"}
              className="w-full"
              onClick={() => void start("document")}
              disabled={pendingMethod !== null}
              data-testid="age-check-document"
            >
              <UserCheck className="size-4" aria-hidden="true" />
              {pendingMethod === "document" ? "Opening…" : "Verify with a photo ID"}
            </Button>
            <p className="text-tiny text-text-muted text-center">
              Handled by our verification provider. GetFanSee never receives or stores your document
              — we keep only the result and the time of the check.
            </p>
          </div>
        )}
      </div>

      <p className="text-tiny text-text-disabled text-center">
        Verification lasts 24 hours, then you will be asked again. Read our{" "}
        <Link href="/privacy" className="underline hover:text-text-muted transition-colors">
          Privacy Policy
        </Link>{" "}
        for what we keep.
      </p>
    </div>
  );
}
