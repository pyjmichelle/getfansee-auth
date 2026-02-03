"use client";

import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LockOverlayProps {
  type: "subscribe" | "ppv";
  price?: number;
  onUnlock?: () => void;
}

export function LockOverlay({ type, price, onUnlock }: LockOverlayProps) {
  return (
    <div
      className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-20"
      data-testid="lock-overlay"
      role="dialog"
      aria-modal="true"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="text-center space-y-4 pointer-events-auto">
        <div
          className="w-16 h-16 rounded-full bg-card border-2 border-border flex items-center justify-center mx-auto"
          data-testid="lock-overlay-icon"
        >
          <Lock className="w-8 h-8 text-muted-foreground" />
        </div>
        <div>
          <p className="text-foreground font-semibold mb-1" data-testid="lock-overlay-title">
            {type === "subscribe" ? "Exclusive Content" : "Premium Content"}
          </p>
          <p className="text-muted-foreground text-sm" data-testid="lock-overlay-description">
            {type === "subscribe" ? "Subscribe to see everything" : `Unlock for $${price}`}
          </p>
        </div>
        {onUnlock && (
          <Button
            data-testid="lock-overlay-button"
            onClick={(event) => {
              event.stopPropagation();
              onUnlock();
            }}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {type === "subscribe" ? "Subscribe & Unlock" : `Unlock for $${price}`}
          </Button>
        )}
      </div>
    </div>
  );
}
