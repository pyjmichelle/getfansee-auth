"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";

function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-0", className)}
      {...props}
    />
  );
}

function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "inline-flex items-center gap-0 border-b border-border-subtle",
        "text-text-muted w-full",
        className
      )}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "inline-flex items-center justify-center gap-1.5",
        // min-h-11 (44px) is the mandatory mobile touch target (DESIGN.md /
        // design-system.mdc) — the previous px-3 py-2.5 alone landed around
        // ~38px, under target on every tab strip in the app at once since
        // this is the single shared trigger.
        "min-h-11 px-3 py-2.5 text-[13px] font-medium whitespace-nowrap select-none",
        "relative border-b-2 border-transparent -mb-px",
        "text-text-muted",
        "transition-[color,border-color] duration-150",
        "focus-visible:outline-none focus-visible:ring-[1.5px] focus-visible:ring-[var(--wine)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--bg-base)] focus-visible:rounded-[var(--radius-xs)]",
        "disabled:pointer-events-none disabled:opacity-30",
        "hover:text-text-secondary",
        "data-[state=active]:text-text-primary data-[state=active]:border-b-[var(--wine)]",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[14px]",
        className
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      // A floor height on every panel (equivalent to TabPanelShell, baked in
      // here so all 27+ call sites get it for free instead of each having to
      // remember to wrap children) — without it, switching from a tall panel
      // to a short one collapses the page height instantly, which is most of
      // what reads as "the UI jumps" on tab switch. Individual instances can
      // still override via className (e.g. `min-h-0`) when a shorter panel
      // is intentional.
      className={cn("flex-1 outline-none mt-3 min-h-[400px]", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
