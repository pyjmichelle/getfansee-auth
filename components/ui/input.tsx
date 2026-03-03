import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "glass-input",
        "h-8 w-full min-w-0 rounded-[var(--radius-sm)]",
        "px-3 py-1.5 text-[13px] text-white",
        "placeholder:text-white/30",
        "selection:bg-violet-500/30 selection:text-white",
        "transition-[border-color,box-shadow,background-color] duration-150",
        "outline-none",
        "file:inline-flex file:h-5 file:border-0 file:bg-transparent file:text-[12px] file:font-medium file:text-white/70",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40",
        "hover:border-white/15",
        "focus-visible:border-violet-500/50 focus-visible:ring-1 focus-visible:ring-violet-500/20 focus-visible:bg-white/6",
        "aria-invalid:border-red-500/60 aria-invalid:ring-1 aria-invalid:ring-red-500/20",
        className
      )}
      {...props}
    />
  );
}

export { Input };
