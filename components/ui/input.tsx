import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground",
        "bg-input border border-border h-11 w-full min-w-0 rounded-xl px-4 py-2.5 text-base shadow-sm",
        "transition-[border-color,box-shadow,background-color] duration-200 motion-safe:transition-[border-color,box-shadow,background-color] motion-reduce:transition-none",
        "outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted/50",
        "focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/30 focus-visible:bg-input-focus",
        "hover:border-border-hover hover:bg-input-focus",
        "aria-invalid:ring-destructive/20 aria-invalid:border-destructive",
        "md:text-sm",
        className
      )}
      {...props}
    />
  );
}

export { Input };
