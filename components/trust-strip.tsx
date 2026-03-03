import { cn } from "@/lib/utils";

interface TrustStripProps {
  items: string[];
  className?: string;
}

export function TrustStrip({ items, className }: TrustStripProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2 text-xs text-text-tertiary", className)}>
      {items.map((item, index) => (
        <span key={item} className="inline-flex items-center gap-2">
          {index > 0 ? <span className="h-1 w-1 rounded-full bg-text-quaternary" /> : null}
          <span>{item}</span>
        </span>
      ))}
    </div>
  );
}
