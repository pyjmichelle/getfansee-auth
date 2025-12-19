"use client"

import { Lock, DollarSign, Check } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface LockBadgeProps {
  type: "free" | "subscribers" | "ppv"
  price?: number
  variant?: "default" | "compact"
  isUnlocked?: boolean
}

export function LockBadge({ type, price, variant = "default", isUnlocked = false }: LockBadgeProps) {
  if (type === "free") {
    return null
  }

  if (isUnlocked) {
    return (
      <Badge variant="secondary" className="bg-green-500/10 text-green-500 hover:bg-green-500/20 border-green-500/20">
        <Check className="w-3 h-3 mr-1" />
        Unlocked
      </Badge>
    )
  }

  if (type === "subscribers") {
    return (
      <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20 border-primary/20">
        <Lock className="w-3 h-3 mr-1" />
        {variant === "compact" ? "Subscribers" : "Subscribers Only"}
      </Badge>
    )
  }

  return (
    <Badge variant="secondary" className="bg-accent/10 text-accent hover:bg-accent/20 border-accent/20">
      <DollarSign className="w-3 h-3 mr-1" />${price}
    </Badge>
  )
}
