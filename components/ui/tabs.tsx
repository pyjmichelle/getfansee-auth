"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";

function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  );
}

function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "bg-secondary text-muted-foreground inline-flex h-11 w-fit items-center justify-center rounded-xl p-1 border border-border shadow-sm",
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
        "text-muted-foreground inline-flex h-full flex-1 items-center justify-center gap-2 rounded-lg border border-transparent px-4 py-2 text-sm font-medium whitespace-nowrap select-none",
        "transition-[color,background-color,box-shadow,border-color] duration-150 motion-safe:transition-[color,background-color,box-shadow,border-color] motion-reduce:transition-none",
        "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/50",
        "disabled:pointer-events-none disabled:opacity-50",
        "hover:text-foreground hover:bg-secondary/80",
        "data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:font-semibold data-[state=active]:shadow-sm data-[state=active]:border-border",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 min-h-[40px]",
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
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
