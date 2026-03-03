import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  [
    "inline-flex items-center justify-center rounded-[var(--radius-xs)] border",
    "px-2 py-0.5 text-[11px] font-medium w-fit whitespace-nowrap shrink-0",
    "[&>svg]:size-3 gap-1 [&>svg]:pointer-events-none",
    "select-none transition-[background-color,color,border-color] duration-150",
    "overflow-hidden",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "bg-white/8 text-white/70 border-white/6 [a&]:hover:bg-white/12",
        rose: "bg-violet-500/15 text-violet-400 border-violet-500/20 [a&]:hover:bg-violet-500/25",
        gold: "bg-amber-500/15 text-amber-400 border-amber-500/20 [a&]:hover:bg-amber-500/25",
        purple: "bg-violet-500/15 text-violet-400 border-violet-500/20 [a&]:hover:bg-violet-500/25",
        success:
          "bg-emerald-500/15 text-emerald-400 border-emerald-500/20 [a&]:hover:bg-emerald-500/25",
        warning: "bg-amber-500/15 text-amber-400 border-amber-500/20 [a&]:hover:bg-amber-500/25",
        destructive: "bg-red-500/15 text-red-400 border-red-500/20 [a&]:hover:bg-red-500/25",
        outline: "bg-transparent border-white/15 text-white/60 [a&]:hover:bg-white/5",
        secondary: "bg-white/6 text-text-secondary border-transparent [a&]:hover:bg-white/10",
        /* Legacy compat */
        info: "bg-blue-500/15 text-blue-400 border-blue-500/20",
        premium: "bg-gradient-premium text-white border-transparent shadow-sm",
        ppv: "bg-gradient-gold text-black border-transparent shadow-sm font-semibold",
        subscribe: "bg-violet-500/15 text-violet-400 border-violet-500/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span";

  return (
    <Comp data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
