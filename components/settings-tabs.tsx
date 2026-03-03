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
      <TabsList className="h-auto w-full justify-start gap-2 rounded-xl bg-surface-raised p-1">
        {items.map((item) => (
          <TabsTrigger
            key={item.value}
            value={item.value}
            className="rounded-lg px-4 py-2 text-sm data-[state=active]:bg-brand-primary data-[state=active]:text-white"
          >
            {item.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {children}
    </Tabs>
  );
}
