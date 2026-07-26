import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "glass-input",
        "flex field-sizing-content min-h-20 w-full rounded-[var(--radius-sm)]",
        "px-3 py-2 text-small text-text-primary",
        "placeholder:text-text-muted",
        "transition-[border-color,box-shadow,background-color] duration-150",
        "outline-none",
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

export { Textarea };
