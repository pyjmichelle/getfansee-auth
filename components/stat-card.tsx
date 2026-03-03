"use client";

import { TrendingUp, TrendingDown, Minus } from "@/lib/icons";
import { GlassIcon } from "@/components/glass-icon";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    trend: "up" | "down" | "neutral";
  };
  icon?: React.ReactNode;
  description?: string;
  className?: string;
  valueClassName?: string;
  variant?: "default" | "glass";
}

export function StatCard({
  title,
  value,
  change,
  icon,
  description,
  className,
  valueClassName,
}: StatCardProps) {
  const trendIcon =
    change?.trend === "up" ? (
      <TrendingUp className="size-[12px]" aria-hidden="true" />
    ) : change?.trend === "down" ? (
      <TrendingDown className="size-[12px]" aria-hidden="true" />
    ) : (
      <Minus className="size-[12px]" aria-hidden="true" />
    );

  const trendColor =
    change?.trend === "up"
      ? "text-emerald-400"
      : change?.trend === "down"
        ? "text-red-400"
        : "text-text-muted";

  return (
    <div
      className={cn("glass-card rounded-[var(--radius-md)] p-4", className)}
      role="region"
      aria-label={`${title}: ${value}`}
    >
      <div className="flex items-start justify-between mb-2">
        <p className="text-[12px] font-medium text-text-muted leading-tight">{title}</p>
        {icon && (
          <GlassIcon size="sm" glow="violet" aria-hidden="true">
            <span className="text-violet-400">{icon}</span>
          </GlassIcon>
        )}
      </div>
      <div className={cn("text-[22px] font-bold text-white leading-tight", valueClassName)}>
        {value}
      </div>
      {change && (
        <div className={cn("flex items-center gap-1 mt-1 text-[11px]", trendColor)}>
          {trendIcon}
          <span>
            {change.trend === "up" ? "+" : change.trend === "down" ? "-" : ""}
            {Math.abs(change.value)}%
          </span>
          <span className="text-text-disabled ml-1">vs last period</span>
        </div>
      )}
      {description && <p className="text-[11px] text-text-muted mt-1.5">{description}</p>}
    </div>
  );
}
