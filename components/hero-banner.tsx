"use client";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

/* -------------------------------------------------------------------------- */
/* HeroBanner                                                                   */
/* -------------------------------------------------------------------------- */

interface HeroBannerProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function HeroBanner({ title, description, action, className }: HeroBannerProps) {
  return (
    <div className={cn("card-block bg-gradient-subtle p-6 md:p-8 mb-6", className)}>
      <h1 className="text-2xl md:text-3xl font-bold text-text-primary mb-2">{title}</h1>
      {description && (
        <p className="text-text-secondary text-sm md:text-base mb-4">{description}</p>
      )}
      {action && <div>{action}</div>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* BentoStats                                                                   */
/* -------------------------------------------------------------------------- */

export interface BentoStatItem {
  label: string;
  value: React.ReactNode;
  /** Apply a 2-column span to this item */
  wide?: boolean;
  className?: string;
}

interface BentoStatsProps {
  items: BentoStatItem[];
  className?: string;
  isLoading?: boolean;
}

export function BentoStats({ items, className, isLoading }: BentoStatsProps) {
  return (
    <div className={cn("bento-grid mb-6", className)}>
      {items.map((item, i) => (
        <div key={i} className={cn("card-block p-5", item.wide && "bento-2x1", item.className)}>
          <p className="text-xs text-text-tertiary mb-1">{item.label}</p>
          {isLoading ? (
            <Skeleton className="h-9 w-24 rounded-lg" />
          ) : (
            <div className="text-3xl font-bold text-text-primary">{item.value}</div>
          )}
        </div>
      ))}
    </div>
  );
}
