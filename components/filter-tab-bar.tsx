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
              "min-w-[120px] min-h-11 flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl border font-semibold text-small whitespace-nowrap transition-[background-color,color,border-color]",
              "active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-brand-primary",
              // Both states always carry a 1px border — only its color
              // changes — so toggling never reflows neighboring pills by
              // the width of a border that used to only exist inactive.
              isActive
                ? "bg-brand-primary text-white border-transparent"
                : "bg-surface-raised text-text-secondary hover:bg-surface-overlay border-border-base"
            )}
          >
            {Icon && <Icon className="w-4 h-4" aria-hidden="true" />}
            <span>{item.label}</span>
            {item.count !== undefined && item.count > 0 && (
              <span
                className={cn(
                  "px-2 py-0.5 rounded-full text-tiny font-bold",
                  isActive ? "bg-white/20 text-white" : "bg-brand-primary-alpha-10 text-wine-text"
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
