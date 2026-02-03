"use client";

import { Lock, DollarSign, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface LockBadgeProps {
  type: "free" | "subscribers" | "ppv";
  price?: number;
  variant?: "default" | "compact";
  isUnlocked?: boolean;
}

export function LockBadge({
  type,
  price,
  variant = "default",
  isUnlocked = false,
}: LockBadgeProps) {
  if (type === "free") {
    return null;
  }

  if (isUnlocked) {
    return (
      <Badge
        variant="secondary"
        className="bg-green-500/10 text-green-500 hover:bg-green-500/20 border-green-500/20"
      >
        <Check className="w-3 h-3 mr-1" />
        Unlocked
      </Badge>
    );
  }

  if (type === "subscribers") {
    return (
      <Badge
        variant="secondary"
        className="glass bg-subscribe-gradient/20 text-[var(--color-pink-400)] border-[var(--border-pink-500-30)] hover:bg-subscribe-gradient/30 hover:border-[var(--border-pink-500-30)] shadow-sm"
      >
        <Lock className="w-3 h-3 mr-1" aria-hidden="true" />
        {variant === "compact" ? "Exclusive" : "Exclusive Content"}
      </Badge>
    );
  }

  return (
    <Badge
      variant="secondary"
      className="glass bg-unlock-gradient/20 text-[var(--color-orange-400)] border-[var(--border-orange-500-30)] hover:bg-unlock-gradient/30 hover:border-[var(--border-orange-500-30)] shadow-sm"
    >
      <DollarSign className="w-3 h-3 mr-1" aria-hidden="true" />${price}
    </Badge>
  );
}
