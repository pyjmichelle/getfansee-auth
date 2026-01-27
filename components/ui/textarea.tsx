import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-2 border-border/50 placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-primary/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive glass flex field-sizing-content min-h-20 w-full rounded-xl px-4 py-3 text-base shadow-sm transition-[border-color,box-shadow,background-color] duration-300 motion-safe:transition-[border-color,box-shadow,background-color] motion-reduce:transition-none outline-none hover:border-accent/40 hover:bg-[rgba(20,20,20,0.9)] disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted/50 md:text-sm",
        className
      )}
      {...props}
    />
  );
}

export { Textarea };
