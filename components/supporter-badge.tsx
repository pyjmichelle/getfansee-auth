import { Heart } from "@/lib/icons";
import { cn } from "@/lib/utils";

interface SupporterBadgeProps {
  size?: number;
  className?: string;
  /** When true, renders a compact icon-only badge. */
  iconOnly?: boolean;
  title?: string;
}

/**
 * Supporter badge — marks a fan who has tipped the creator.
 * Purely symbolic recognition; tips remain voluntary gratuities with no owed benefit.
 */
export function SupporterBadge({
  size = 12,
  className,
  iconOnly = false,
  title = "Supporter",
}: SupporterBadgeProps) {
  if (iconOnly) {
    return (
      <span role="img" aria-label="Supporter" title={title} className="inline-flex shrink-0">
        <Heart
          aria-hidden
          style={{ width: size, height: size }}
          className={cn("text-[var(--premium)]", className)}
        />
      </span>
    );
  }

  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-[var(--premium)]/15 text-[var(--premium)] px-2 py-0.5 text-tiny font-medium shrink-0",
        className
      )}
    >
      <Heart style={{ width: size, height: size }} aria-hidden />
      Supporter
    </span>
  );
}
