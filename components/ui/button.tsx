import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-[transform,opacity,box-shadow,background-color] duration-300 motion-safe:transition-[transform,opacity,box-shadow,background-color] motion-reduce:transition-none hover:scale-[1.02] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:active:scale-100 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-[3px] focus-visible:ring-primary/50 focus-visible:outline-none aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "bg-primary-gradient text-white font-semibold hover:shadow-primary-glow hover-glow rounded-xl shadow-lg backdrop-blur-sm",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60 rounded-xl",
        outline:
          "border-2 border-border/50 glass hover:border-accent/50 hover:shadow-accent-glow/30 active:bg-[rgba(15,15,15,0.9)] rounded-xl",
        secondary:
          "glass text-foreground border-2 border-border/50 hover:border-accent/30 hover:shadow-sm active:bg-[rgba(15,15,15,0.9)] rounded-xl",
        ghost: "hover:glass hover:text-foreground active:bg-[rgba(255,255,255,0.05)] rounded-xl",
        link: "text-primary underline-offset-4 hover:underline font-medium",
        gradient:
          "bg-primary-gradient text-white font-bold hover:shadow-primary-glow hover-glow rounded-xl shadow-lg backdrop-blur-sm",
        "accent-gradient":
          "bg-accent-gradient text-foreground font-bold hover:shadow-accent-glow hover-glow rounded-xl shadow-lg backdrop-blur-sm",
        "subscribe-gradient":
          "bg-subscribe-gradient text-white font-bold hover:shadow-subscribe-glow hover-glow rounded-xl shadow-lg backdrop-blur-sm",
        "unlock-gradient":
          "bg-unlock-gradient text-white font-bold hover:shadow-unlock-glow hover-glow rounded-xl shadow-lg backdrop-blur-sm",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
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
