"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface SettingsTabsProps {
  value: string;
  onValueChange: (value: string) => void;
  items: Array<{ value: string; label: string }>;
  children?: React.ReactNode;
  className?: string;
}

export function SettingsTabs({
  value,
  onValueChange,
  items,
  children,
  className,
}: SettingsTabsProps) {
  return (
    <Tabs value={value} onValueChange={onValueChange} className={cn("w-full", className)}>
      {/* Mobile-only: on desktop the parent page's sidebar (aside) already
          provides this navigation — rendering both was a duplicate-nav bug
          (F-001). */}
      <TabsList className="md:hidden h-auto w-full justify-start gap-2 rounded-xl bg-surface-raised p-1 overflow-x-auto no-scrollbar">
        {items.map((item) => (
          <TabsTrigger
            key={item.value}
            value={item.value}
            className="rounded-lg px-4 py-2 text-small shrink-0 data-[state=active]:bg-[var(--wine)] data-[state=active]:text-text-primary"
          >
            {item.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {children}
    </Tabs>
  );
}
