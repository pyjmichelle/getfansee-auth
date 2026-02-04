import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground glass border-2 border-border/50 h-10 w-full min-w-0 rounded-xl px-4 py-2 text-base shadow-sm transition-[border-color,box-shadow,background-color] duration-300 motion-safe:transition-[border-color,box-shadow,background-color] motion-reduce:transition-none outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted/50 md:text-sm",
        "focus-visible:border-primary focus-visible:ring-primary/50 focus-visible:ring-[3px] focus-visible:shadow-primary-glow/50",
        "hover:border-accent/40 hover:bg-[rgba(20,20,20,0.9)]",
        "aria-invalid:ring-destructive/20 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  );
}

export { Input };
