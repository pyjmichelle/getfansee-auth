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
        rose: "bg-[var(--wine)]/15 text-wine-text border-[var(--wine)]/20 [a&]:hover:bg-[var(--wine)]/25",
        gold: "bg-[var(--premium)]/15 text-[var(--premium)] border-[var(--premium)]/20 [a&]:hover:bg-[var(--premium)]/25",
        purple:
          "bg-[var(--wine)]/15 text-wine-text border-[var(--wine)]/20 [a&]:hover:bg-[var(--wine)]/25",
        success:
          "bg-[var(--success)]/15 text-[var(--success)] border-[var(--success)]/20 [a&]:hover:bg-[var(--success)]/25",
        warning:
          "bg-[var(--warning)]/15 text-[var(--warning)] border-[var(--warning)]/20 [a&]:hover:bg-[var(--warning)]/25",
        destructive:
          "bg-[var(--error)]/15 text-[var(--error-text)] border-[var(--error)]/20 [a&]:hover:bg-[var(--error)]/25",
        outline: "bg-transparent border-white/15 text-white/60 [a&]:hover:bg-white/5",
        secondary: "bg-white/6 text-text-secondary border-transparent [a&]:hover:bg-white/10",
        /* Legacy compat */
        info: "bg-[var(--info)]/15 text-[var(--info)] border-[var(--info)]/20",
        premium:
          "bg-[var(--premium-tint)] text-[var(--premium)] border-[var(--premium)]/40 shadow-none font-semibold",
        ppv: "bg-[var(--premium-tint)] text-[var(--premium)] border-[var(--premium)]/40 shadow-none font-semibold",
        subscribe: "bg-[var(--wine)]/15 text-wine-text border-[var(--wine)]/20",
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
