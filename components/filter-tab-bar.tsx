"use client";

import { cn } from "@/lib/utils";
import type { LucideIcon } from "@/lib/icons";

export interface FilterTabItem {
  id: string;
  label: string;
  icon?: LucideIcon;
  count?: number;
}

interface FilterTabBarProps {
  items: FilterTabItem[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}

export function FilterTabBar({ items, active, onChange, className }: FilterTabBarProps) {
  return (
    <div className={cn("snap-row mb-6", className)} role="tablist" aria-label="Filter options">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = active === item.id;
        return (
          <button
            key={item.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(item.id)}
            className={cn(
              "min-w-[120px] flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl font-semibold text-sm whitespace-nowrap transition-all",
              "active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-brand-primary",
              isActive
                ? "bg-brand-primary text-white shadow-glow"
                : "bg-surface-raised text-text-secondary hover:bg-surface-overlay border border-border-base"
            )}
          >
            {Icon && <Icon className="w-4 h-4" aria-hidden="true" />}
            <span>{item.label}</span>
            {item.count !== undefined && item.count > 0 && (
              <span
                className={cn(
                  "px-2 py-0.5 rounded-full text-xs font-bold",
                  isActive
                    ? "bg-white/20 text-white"
                    : "bg-brand-primary-alpha-10 text-brand-primary"
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
