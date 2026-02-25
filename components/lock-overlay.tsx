"use client";

import { Lock, Clock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface LockOverlayProps {
  type: "subscribe" | "ppv";
  price?: number;
  subscriptionPrice?: number;
  isExclusive?: boolean;
  onUnlock?: () => void;
  onSubscribe?: () => void;
  className?: string;
}

/**
 * LockOverlay - Premium Design Lock Overlay
 *
 * Features:
 * - Gradient background overlay
 * - Glowing lock icon
 * - Urgency badge for exclusive content
 * - Emotional copy
 * - Subscribe alternative option
 */
export function LockOverlay({
  type,
  price,
  subscriptionPrice,
  isExclusive,
  onUnlock,
  onSubscribe,
  className,
}: LockOverlayProps) {
  return (
    <div
      className={cn(
        "absolute inset-0 flex items-center justify-center z-20",
        "bg-gradient-to-b from-black/20 via-black/40 to-black/60",
        className
      )}
      data-testid="lock-overlay"
      role="dialog"
      aria-modal="true"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="text-center px-6 max-w-sm pointer-events-auto">
        {/* Urgency Badge */}
        {isExclusive && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-error/20 border border-error/40 rounded-full text-error text-xs font-bold mb-4 animate-pulse">
            <Clock size={14} className="shrink-0" />
            <span>24HR EXCLUSIVE</span>
          </div>
        )}

        {/* Lock Icon with Glow */}
        <div
          className="w-16 h-16 mx-auto mb-4 bg-primary/20 backdrop-blur-md rounded-full flex items-center justify-center border border-primary/30 shadow-glow"
          data-testid="lock-overlay-icon"
        >
          <Lock size={28} className="text-primary" />
        </div>

        {/* Title & Description */}
        <div className="mb-4">
          <p className="text-white/90 text-sm mb-1 font-medium" data-testid="lock-overlay-title">
            Unlock Exclusive Content
          </p>
          <p className="text-white/60 text-xs mb-4" data-testid="lock-overlay-description">
            {type === "subscribe"
              ? "Subscribe to access all exclusive content"
              : "Behind-the-scenes • High quality"}
          </p>
        </div>

        {/* Primary CTA */}
        {onUnlock && (
          <Button
            data-testid="lock-overlay-button"
            variant={type === "subscribe" ? "subscribe-gradient" : "unlock-gradient"}
            size="lg"
            className="w-full px-8 py-4 text-lg font-bold rounded-xl mb-3"
            onClick={(event) => {
              event.stopPropagation();
              onUnlock();
            }}
          >
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-2">
                {type === "subscribe" ? (
                  <>
                    <Sparkles size={20} />
                    <span>Subscribe Now</span>
                  </>
                ) : (
                  <>
                    <Lock size={20} />
                    <span>Unlock Now · ${price?.toFixed(2)}</span>
                  </>
                )}
              </div>
              {type === "ppv" && (
                <p className="text-xs text-white/70 font-normal mt-0.5">
                  One-time access · Instant delivery
                </p>
              )}
            </div>
          </Button>
        )}

        {/* Subscribe Alternative for PPV */}
        {type === "ppv" && subscriptionPrice && onSubscribe && (
          <p className="text-xs text-white/60">
            Or{" "}
            <button
              onClick={(event) => {
                event.stopPropagation();
                onSubscribe();
              }}
              className="text-brand-primary font-semibold underline hover:text-brand-primary/80 transition-colors"
            >
              subscribe for ${subscriptionPrice.toFixed(2)}/mo
            </button>{" "}
            for unlimited access
          </p>
        )}
      </div>
    </div>
  );
}
