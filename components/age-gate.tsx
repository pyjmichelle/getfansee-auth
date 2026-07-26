"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "@/lib/icons";

const AGE_VERIFIED_KEY = "getfansee_age_verified";
const AGE_VERIFIED_VALUE = "true";

const EXEMPT_ROUTES = [
  "/age-denied",
  "/terms",
  "/privacy",
  "/dmca",
  // /auth (login/register) is intentionally NOT exempt — age gate must fire on first visit.
  // Only deep sub-routes that arrive via external links (email, OAuth) are exempt.
  "/auth/verify",
  "/auth/error",
  "/auth/resend-verification",
  "/auth/forgot-password",
  "/auth/reset-password",
];

interface AgeGateProps {
  children: React.ReactNode;
}

export function AgeGate({ children }: AgeGateProps) {
  const [isVerified, setIsVerified] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [showDenied, setShowDenied] = useState(false);
  const pathname = usePathname();

  const isExemptRoute = EXEMPT_ROUTES.some(
    (route) => pathname === route || pathname?.startsWith(route + "/")
  );

  useEffect(() => {
    const isTestMode =
      typeof document !== "undefined" && document.cookie.includes("playwright-test-mode=1");

    if (isTestMode) {
      localStorage.setItem(AGE_VERIFIED_KEY, AGE_VERIFIED_VALUE);
      setIsVerified(true);
      setIsChecking(false);
      return;
    }

    const verified = localStorage.getItem(AGE_VERIFIED_KEY) === AGE_VERIFIED_VALUE;
    setIsVerified(verified);
    setIsChecking(false);
  }, []);

  const handleConfirmAge = () => {
    localStorage.setItem(AGE_VERIFIED_KEY, AGE_VERIFIED_VALUE);
    setIsVerified(true);
    // Storage events don't fire in the same tab that wrote them, so other
    // gated UI (e.g. CookieConsent) listens for this custom event instead to
    // avoid rendering on top of the age gate (F-003 popup layering rule).
    window.dispatchEvent(new CustomEvent("gfs:age-verified"));
    // Log age gate confirmation for compliance audit (non-blocking, fire-and-forget)
    try {
      let sessionId = localStorage.getItem("getfansee_session_id");
      if (!sessionId) {
        sessionId = crypto.randomUUID();
        localStorage.setItem("getfansee_session_id", sessionId);
      }
      fetch("/api/age-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      }).catch(() => {
        // Silently ignore network errors — client-side verification is the gate
      });
    } catch {
      // Silently ignore if crypto/fetch not available
    }
  };

  const handleDenyAge = () => {
    setShowDenied(true);
  };

  if (isExemptRoute) return <>{children}</>;

  // Denied state — full screen message (no deadclick risk, children not rendered)
  if (showDenied) {
    return (
      <div className="min-h-dvh bg-bg-base flex items-center justify-center p-4">
        <div
          className="max-w-sm w-full text-center glass-panel rounded-[var(--radius-lg)] p-8 space-y-4"
          data-testid="age-denied-message"
        >
          <div className="size-14 mx-auto rounded-full bg-[var(--error)]/10 flex items-center justify-center">
            <ShieldAlert className="size-6 text-[var(--error-text)]" aria-hidden="true" />
          </div>
          <h1 className="text-h3 font-semibold text-text-primary">Access Denied</h1>
          <p className="text-small text-text-muted">
            You must be 18 years or older to access this website. This site contains adult content
            that is not suitable for minors.
          </p>
          <p className="text-tiny text-text-disabled">
            If you believe you received this message in error, please close this browser window and
            try again.
          </p>
        </div>
      </div>
    );
  }

  // Verified: render children directly, no overlay
  if (!isChecking && isVerified) {
    return <>{children}</>;
  }

  // Checking or unverified: render children underneath the gate overlay.
  // Children are always interactive-eligible — the fixed overlay captures pointer events,
  // eliminating the "visible but unclickable" deadclick window from the previous approach.
  return (
    <>
      {children}
      {/* Gate overlay — shown while checking or while unverified */}
      <div
        className="fixed inset-0 glass-overlay flex items-center justify-center p-4"
        style={{ zIndex: "var(--z-age-gate)" as unknown as number }}
        aria-modal="true"
        role="dialog"
        aria-label="Age verification"
      >
        {isChecking ? (
          // Brief loading state while reading localStorage — avoids layout flash
          <div className="min-h-dvh bg-bg-base" aria-hidden="true" />
        ) : (
          <div
            className="glass-panel rounded-[var(--radius-lg)] border border-border-default p-6 max-w-sm w-full"
            data-testid="age-gate-modal"
          >
            <div className="flex flex-col items-center text-center mb-5">
              <div className="size-12 rounded-full bg-[var(--wine)]/15 border border-[var(--wine)]/20 flex items-center justify-center mb-3">
                <ShieldAlert className="size-5 text-wine-text" aria-hidden="true" />
              </div>
              <h2 className="text-h3 font-semibold text-text-primary mb-1">
                Age Verification Required
              </h2>
              <p className="text-small text-text-muted">
                This website contains age-restricted content. By entering, you confirm you are 18
                years or older.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Button
                size="lg"
                className="w-full"
                onClick={handleConfirmAge}
                data-testid="age-gate-yes"
                aria-label="I am 18 or older — confirm and enter site"
              >
                Enter Site — I am 18+
              </Button>
              <Button
                variant="ghost"
                size="default"
                className="w-full"
                onClick={handleDenyAge}
                data-testid="age-gate-no"
                aria-label="I am under 18 years old"
              >
                Exit
              </Button>
            </div>

            <p className="text-tiny text-text-disabled mt-4 text-center">
              By continuing you agree to our{" "}
              <a href="/terms" className="underline hover:text-text-muted transition-colors">
                Terms of Service
              </a>
            </p>
          </div>
        )}
      </div>
    </>
  );
}
