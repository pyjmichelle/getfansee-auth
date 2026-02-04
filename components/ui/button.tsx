import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-[transform,opacity,box-shadow,background-color,border-color] duration-200 motion-safe:transition-[transform,opacity,box-shadow,background-color,border-color] motion-reduce:transition-none hover:scale-[1.02] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:active:scale-100 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-[3px] focus-visible:ring-primary/50 focus-visible:outline-none aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive select-none",
  {
    variants: {
      variant: {
        default:
          "bg-primary-gradient text-white font-semibold shadow-md hover:shadow-subscribe-glow hover-glow",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 hover:shadow-md focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40",
        outline:
          "border border-border bg-transparent hover:bg-secondary/50 hover:border-border-hover active:bg-secondary/70",
        secondary:
          "bg-secondary text-foreground border border-border/50 hover:bg-secondary/80 hover:border-border-hover active:bg-secondary/90",
        ghost: "bg-transparent hover:bg-secondary/60 hover:text-foreground active:bg-secondary/80",
        link: "text-primary underline-offset-4 hover:underline font-medium hover:text-primary-hover",
        gradient:
          "bg-primary-gradient text-white font-bold shadow-md hover:shadow-subscribe-glow hover-glow",
        "accent-gradient":
          "bg-accent-gradient text-white font-bold shadow-md hover:shadow-accent-glow hover-glow",
        "subscribe-gradient":
          "bg-subscribe-gradient text-white font-bold shadow-md hover:shadow-subscribe-glow hover-glow",
        "unlock-gradient":
          "bg-unlock-gradient text-white font-bold shadow-md hover:shadow-unlock-glow hover-glow",
        "success-gradient":
          "bg-success-gradient text-white font-bold shadow-md hover:shadow-success-glow hover-glow",
      },
      size: {
        default: "h-10 min-h-[44px] px-5 py-2.5 has-[>svg]:px-4",
        sm: "h-8 min-h-[36px] gap-1.5 px-3.5 has-[>svg]:px-3 text-sm",
        lg: "h-12 min-h-[48px] px-7 has-[>svg]:px-5 text-base",
        icon: "size-10 min-h-[44px] min-w-[44px]",
        "icon-sm": "size-8 min-h-[36px] min-w-[36px]",
        "icon-lg": "size-12 min-h-[48px] min-w-[48px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
