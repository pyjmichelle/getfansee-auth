import { Star } from "@/lib/icons";
import { cn } from "@/lib/utils";

interface FoundingCreatorBadgeProps {
  size?: number;
  className?: string;
  /** Render as a labeled pill instead of a bare icon. */
  withLabel?: boolean;
}

/**
 * Founding Creator badge — granted to creators who completed KYC during the
 * Pre-Payment Alpha (profiles.is_founding_creator = true). Permanent badge;
 * also signals the Beta 0% commission window.
 *
 * Usage: {creator.is_founding_creator && <FoundingCreatorBadge />}
 */
export function FoundingCreatorBadge({
  size = 14,
  className,
  withLabel = false,
}: FoundingCreatorBadgeProps) {
  if (withLabel) {
    return (
      <span
        role="img"
        aria-label="Founding Creator"
        title="Founding Creator — joined during Alpha"
        className={cn(
          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-tiny font-semibold",
          "bg-[var(--premium-tint,rgba(212,175,55,0.12))] text-[var(--premium)] shrink-0",
          className
        )}
      >
        <Star aria-hidden style={{ width: size, height: size }} />
        Founding Creator
      </span>
    );
  }

  return (
    <span
      role="img"
      aria-label="Founding Creator"
      title="Founding Creator — joined during Alpha"
      className="inline-flex shrink-0"
    >
      <Star
        aria-hidden
        style={{ width: size, height: size }}
        className={cn("text-[var(--premium)]", className)}
      />
    </span>
  );
}
