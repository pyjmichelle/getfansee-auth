import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "glass-input",
        "h-10 w-full min-w-0 rounded-[var(--radius-sm)]",
        "px-3 py-2 text-small text-text-primary",
        "placeholder:text-text-muted",
        "selection:bg-[var(--wine)]/30 selection:text-text-primary",
        "transition-[border-color,box-shadow,background-color] duration-150",
        "outline-none",
        "file:inline-flex file:h-5 file:border-0 file:bg-transparent file:text-tiny file:font-medium file:text-text-secondary",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40",
        "hover:border-[var(--border-default)]",
        "focus-visible:border-[var(--wine)]/50 focus-visible:ring-1 focus-visible:ring-[var(--wine)]/20 focus-visible:bg-white/6",
        "aria-invalid:border-[var(--error)]/60 aria-invalid:ring-1 aria-invalid:ring-[var(--error)]/20",
        className
      )}
      {...props}
    />
  );
}

export { Input };
