"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { X } from "@/lib/icons";

const COOKIE_CONSENT_KEY = "getfansee_cookie_consent";

type ConsentState = "accepted" | "declined" | null;

export function CookieConsent() {
  const [consentState, setConsentState] = useState<ConsentState | "loading">("loading");

  useEffect(() => {
    const stored = localStorage.getItem(COOKIE_CONSENT_KEY) as ConsentState | null;
    setConsentState(stored);
  }, []);

  const handleAccept = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, "accepted");
    setConsentState("accepted");
  };

  const handleDecline = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, "declined");
    setConsentState("declined");
  };

  // Don't show banner until we've checked localStorage (avoids flash)
  if (consentState === "loading" || consentState !== null) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      aria-live="polite"
      className="fixed bottom-0 left-0 right-0 z-50 p-4 md:bottom-6 md:left-6 md:right-auto md:max-w-sm"
    >
      <div className="glass-panel rounded-2xl border border-white/10 p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3 mb-3">
          <h2 className="text-sm font-semibold text-text-primary leading-snug">
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
        <p className="text-xs text-text-tertiary leading-relaxed mb-4">
          We use cookies and analytics to improve your experience and understand how you use our
          site. See our{" "}
          <Link href="/privacy" className="text-brand-primary underline hover:no-underline">
            Privacy Policy
          </Link>{" "}
          for details.
        </p>
        <div className="flex gap-2">
          <Button
            onClick={handleAccept}
            size="sm"
            className="flex-1 bg-brand-primary text-white text-xs font-semibold hover-bold"
          >
            Accept All
          </Button>
          <Button
            onClick={handleDecline}
            size="sm"
            variant="outline"
            className="flex-1 text-xs bg-transparent font-semibold"
          >
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
