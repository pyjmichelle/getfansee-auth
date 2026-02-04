import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-lg border px-2.5 py-1 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1.5 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow,background-color] duration-150 overflow-hidden select-none",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        destructive:
          "border-transparent bg-destructive text-white [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40",
        outline:
          "border-border text-foreground bg-transparent [a&]:hover:bg-secondary [a&]:hover:text-foreground",
        success:
          "border-transparent bg-[var(--success)]/15 text-[var(--success)] [a&]:hover:bg-[var(--success)]/25",
        warning:
          "border-transparent bg-[var(--warning)]/15 text-[var(--warning)] [a&]:hover:bg-[var(--warning)]/25",
        info: "border-transparent bg-[var(--info)]/15 text-[var(--info)] [a&]:hover:bg-[var(--info)]/25",
        premium:
          "border-transparent bg-subscribe-gradient text-white shadow-sm [a&]:hover:shadow-subscribe-glow",
        ppv: "border-transparent bg-unlock-gradient text-white shadow-sm [a&]:hover:shadow-unlock-glow",
        subscribe: "border-transparent bg-primary/15 text-primary [a&]:hover:bg-primary/25",
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
