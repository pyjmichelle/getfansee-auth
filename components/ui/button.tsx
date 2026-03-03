import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-medium select-none",
    "rounded-[var(--radius-sm)] border border-transparent",
    "transition-[transform,opacity,background-color,box-shadow,border-color,filter]",
    "duration-150 ease-out",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-black",
    "disabled:pointer-events-none disabled:opacity-40 disabled:cursor-not-allowed",
    "active:scale-[0.97]",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[14px]",
    "shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        /* Default — subtle glass */
        default: "bg-white/10 text-white border-white/8 hover:bg-white/15 hover:border-white/12",

        /* Violet gradient — primary CTA (replaces rose) */
        rose: "bg-gradient-rose text-white shadow-glow-violet hover:brightness-110 hover:saturate-110 hover:shadow-glow-violet-lg",
        violet:
          "bg-gradient-rose text-white shadow-glow-violet hover:brightness-110 hover:saturate-110 hover:shadow-glow-violet-lg",

        /* Gold gradient — purchase/unlock/tip */
        gold: "bg-gradient-gold text-white font-semibold shadow-glow-gold hover:brightness-110 hover:shadow-glow-gold-lg",

        /* Indigo — secondary accent */
        purple: "bg-gradient-purple text-white hover:brightness-110 hover:shadow-glow-purple",

        /* Premium — violet→indigo */
        premium: "bg-gradient-premium text-white shadow-glow-violet hover:brightness-110",

        /* Ghost — minimal */
        ghost:
          "bg-transparent text-text-secondary border-transparent hover:bg-white/5 hover:text-white",

        /* Outline — bordered */
        outline: "bg-transparent text-white border-white/12 hover:border-white/20 hover:bg-white/5",

        /* Destructive */
        destructive:
          "bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20 hover:text-red-300",

        /* Link */
        link: "bg-transparent text-violet-400 underline-offset-4 hover:underline border-transparent p-0 h-auto",

        /* Success */
        success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20",

        /* Secondary */
        secondary:
          "bg-white/6 text-text-secondary border-white/8 hover:bg-white/10 hover:text-white",

        /* ── Legacy compat aliases (kept for gradual migration) ── */
        gradient: "bg-gradient-rose text-white shadow-glow-violet hover:brightness-110",
        "accent-gradient": "bg-gradient-gold text-white font-semibold hover:brightness-110",
        "subscribe-gradient": "bg-gradient-rose text-white shadow-glow-violet hover:brightness-110",
        "unlock-gradient":
          "bg-gradient-gold text-white font-semibold shadow-glow-gold hover:brightness-110",
        "success-gradient": "bg-emerald-500 text-white hover:brightness-110",
        "tip-gradient": "bg-gradient-gold text-white font-semibold hover:brightness-110",
        "purple-gradient": "bg-gradient-purple text-white hover:brightness-110",
        "premium-gradient":
          "bg-gradient-premium text-white shadow-glow-violet hover:brightness-110",
      },
      size: {
        xs: "h-6 px-2 text-[11px] rounded-[var(--radius-xs)]",
        sm: "h-7 px-2.5 text-[12px]",
        default: "h-8 px-3 text-[13px]",
        lg: "h-9 px-4 text-[13px]",
        xl: "h-10 px-5 text-[14px]",
        icon: "size-8 p-0",
        "icon-sm": "size-7 p-0",
        "icon-lg": "size-9 p-0",
        "icon-xs": "size-6 p-0",
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
