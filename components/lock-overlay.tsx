"use client"

import { Lock } from "lucide-react"
import { Button } from "@/components/ui/button"

interface LockOverlayProps {
  type: "subscribe" | "ppv"
  price?: number
  onUnlock?: () => void
}

export function LockOverlay({ type, price, onUnlock }: LockOverlayProps) {
  return (
    <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-card border-2 border-border flex items-center justify-center mx-auto">
          <Lock className="w-8 h-8 text-muted-foreground" />
        </div>
        <div>
          <p className="text-foreground font-semibold mb-1">
            {type === "subscribe" ? "Subscribers Only" : "Pay Per View"}
          </p>
          <p className="text-muted-foreground text-sm">
            {type === "subscribe" ? "Subscribe to unlock this content" : `Unlock for $${price}`}
          </p>
        </div>
        {onUnlock && (
          <Button onClick={onUnlock} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            {type === "subscribe" ? "Subscribe Now" : `Unlock for $${price}`}
          </Button>
        )}
      </div>
    </div>
  )
}
