"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { X } from "@/lib/icons";

const COOKIE_CONSENT_KEY = "getfansee_cookie_consent";
const AGE_VERIFIED_KEY = "getfansee_age_verified";

type ConsentState = "accepted" | "declined" | null;

export function CookieConsent() {
  const [consentState, setConsentState] = useState<ConsentState | "loading">("loading");
  const [ageVerified, setAgeVerified] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(COOKIE_CONSENT_KEY) as ConsentState | null;
    setConsentState(stored);
    setAgeVerified(localStorage.getItem(AGE_VERIFIED_KEY) === "true");

    // AgeGate dispatches this on confirm — storage events don't fire in the
    // same tab that wrote them, so we can't rely on the `storage` event here.
    // Sequencing gate: never stack this banner on top of the age gate (F-003).
    const onAgeVerified = () => setAgeVerified(true);
    window.addEventListener("gfs:age-verified", onAgeVerified);
    return () => window.removeEventListener("gfs:age-verified", onAgeVerified);
  }, []);

  const handleAccept = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, "accepted");
    setConsentState("accepted");
  };

  const handleDecline = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, "declined");
    setConsentState("declined");
  };

  // Don't show banner until we've checked localStorage (avoids flash), until
  // the visitor has already made a choice, or before the age gate clears.
  if (consentState === "loading" || consentState !== null || !ageVerified) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      aria-live="polite"
      // Mobile: sit above the fixed BottomNavigation (--bottom-nav-height +
      // safe-area) instead of overlapping it — previously covered the
      // Create/Publish action entirely (F-003). Derived from the shared
      // token instead of a hardcoded "60px" so this can't silently drift
      // out of sync if the nav's height ever changes.
      className="fixed left-0 right-0 p-4 bottom-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom)+12px)] lg:bottom-6 lg:left-6 lg:right-auto lg:max-w-sm"
      style={{ zIndex: "var(--z-toast)" as unknown as number }}
    >
      <div className="glass-panel rounded-2xl border border-border-default p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3 mb-3">
          <h2 className="text-small font-semibold text-text-primary leading-snug">
            Cookie Preferences
          </h2>
          <button
            onClick={handleDecline}
            className="text-text-quaternary hover:text-text-secondary transition-colors flex-shrink-0 mt-0.5"
            aria-label="Decline cookies and close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-tiny text-text-tertiary leading-relaxed mb-4">
          We use cookies and analytics to improve your experience and understand how you use our
          site. See our{" "}
          <Link href="/privacy" className="text-wine-text underline hover:no-underline">
            Privacy Policy
          </Link>{" "}
          for details.
        </p>
        <div className="flex gap-2">
          <Button onClick={handleAccept} size="sm" className="flex-1">
            Accept All
          </Button>
          <Button onClick={handleDecline} size="sm" variant="outline" className="flex-1">
            Decline
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Returns the current cookie consent state from localStorage.
 * Can be used to gate analytics initialisation.
 */
export function getCookieConsent(): ConsentState {
  if (typeof window === "undefined") return null;
  return (localStorage.getItem(COOKIE_CONSENT_KEY) as ConsentState) ?? null;
}
