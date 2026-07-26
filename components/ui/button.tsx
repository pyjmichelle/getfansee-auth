import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "@/lib/icons";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-medium select-none",
    "rounded-[var(--radius-sm)] border border-transparent",
    "transition-[background-color,border-color,color,opacity] duration-150 ease-out",
    "focus-visible:outline-none focus-visible:ring-[1.5px] focus-visible:ring-[var(--wine)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-base)]",
    "disabled:pointer-events-none disabled:opacity-40 disabled:cursor-not-allowed",
    "active:scale-[0.98]",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[14px]",
    "shrink-0 cursor-pointer",
  ].join(" "),
  {
    variants: {
      variant: {
        /* Wine — primary action (Subscribe, Unlock, Tip, Sign In) */
        default:
          "bg-[var(--wine)] text-[#F5F0EE] border-[var(--wine)] hover:bg-[var(--wine-hover)] hover:border-[var(--wine-hover)]",

        /* Champagne gold — premium identity ONLY (paid status, top supporter) */
        premium:
          "bg-[var(--premium-tint)] text-[#1A1210] border-[var(--premium)]/40 hover:bg-[var(--premium)] hover:border-[var(--premium)] font-semibold",

        /* Secondary — surface-raised neutral */
        secondary:
          "bg-[var(--bg-raised)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:bg-[var(--bg-raised)] hover:border-[var(--border-default)] hover:text-[var(--text-primary)]",

        /* Ghost — minimal */
        ghost:
          "bg-transparent text-[var(--text-muted)] border-transparent hover:bg-white/5 hover:text-[var(--text-primary)]",

        /* Outline — bordered */
        outline:
          "bg-transparent text-[var(--text-primary)] border-[var(--border-default)] hover:border-[var(--border-strong)] hover:bg-white/4",

        /* Destructive — semantic error */
        destructive:
          "bg-[var(--error)]/10 text-[var(--error)] border-[var(--error)]/20 hover:bg-[var(--error)]/20",

        /* Link */
        link: "bg-transparent text-wine-text underline-offset-4 hover:underline border-transparent p-0 h-auto",

        /* Success */
        success:
          "bg-[var(--success)]/10 text-[var(--success)] border-[var(--success)]/20 hover:bg-[var(--success)]/20",

        /* ── Legacy aliases — all map to wine default ── */
        rose: "bg-[var(--wine)] text-[#F5F0EE] border-[var(--wine)] hover:bg-[var(--wine-hover)]",
        violet: "bg-[var(--wine)] text-[#F5F0EE] border-[var(--wine)] hover:bg-[var(--wine-hover)]",
        gold: "bg-[var(--wine)] text-[#F5F0EE] border-[var(--wine)] hover:bg-[var(--wine-hover)]",
        purple: "bg-[var(--wine)] text-[#F5F0EE] border-[var(--wine)] hover:bg-[var(--wine-hover)]",
        gradient:
          "bg-[var(--wine)] text-[#F5F0EE] border-[var(--wine)] hover:bg-[var(--wine-hover)]",
        "accent-gradient":
          "bg-[var(--wine)] text-[#F5F0EE] border-[var(--wine)] hover:bg-[var(--wine-hover)]",
        "subscribe-gradient":
          "bg-[var(--wine)] text-[#F5F0EE] border-[var(--wine)] hover:bg-[var(--wine-hover)]",
        "unlock-gradient":
          "bg-[var(--wine)] text-[#F5F0EE] border-[var(--wine)] hover:bg-[var(--wine-hover)]",
        "success-gradient": "bg-[var(--success)] text-[#F5F0EE] hover:opacity-90",
        "tip-gradient":
          "bg-[var(--wine)] text-[#F5F0EE] border-[var(--wine)] hover:bg-[var(--wine-hover)]",
        "purple-gradient":
          "bg-[var(--wine)] text-[#F5F0EE] border-[var(--wine)] hover:bg-[var(--wine-hover)]",
        "premium-gradient":
          "bg-[var(--premium-tint)] text-[#1A1210] border-[var(--premium)]/40 hover:bg-[var(--premium)]",
      },
      size: {
        /* 3 canonical sizes: sm=32px / md=40px (default) / lg=48px */
        sm: "h-8 px-3 text-[0.8125rem] rounded-[var(--radius-sm)]",
        md: "h-10 px-4 text-[0.9375rem] rounded-[var(--radius-sm)]",
        lg: "h-12 px-5 text-[1rem] rounded-[var(--radius-md)]",
        /* Aliases */
        default: "h-10 px-4 text-[0.9375rem] rounded-[var(--radius-sm)]",
        xs: "h-8 px-3 text-[0.8125rem] rounded-[var(--radius-sm)]",
        xl: "h-12 px-5 text-[1rem] rounded-[var(--radius-md)]",
        /* Icon variants */
        icon: "size-10 p-0 rounded-[var(--radius-sm)]",
        "icon-sm": "size-8 p-0 rounded-[var(--radius-sm)]",
        "icon-lg": "size-12 p-0 rounded-[var(--radius-md)]",
        "icon-xs": "size-8 p-0 rounded-[var(--radius-sm)]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  loading,
  children,
  disabled,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    loading?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="size-[14px] animate-spin" aria-hidden />
          {children}
        </>
      ) : (
        children
      )}
    </Comp>
  );
}

export { Button, buttonVariants };
