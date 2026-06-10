import { CheckCircle2 } from "@/lib/icons";
import { cn } from "@/lib/utils";

interface VerifiedBadgeProps {
  size?: number;
  className?: string;
  title?: string;
}

/**
 * Verified creator badge — shown only when the creator's KYC is approved
 * (profiles.is_verified = true). Never renders for unverified creators.
 *
 * Usage: {creator.is_verified && <VerifiedBadge />}
 */
export function VerifiedBadge({
  size = 14,
  className,
  title = "Verified creator",
}: VerifiedBadgeProps) {
  return (
    <span role="img" aria-label="Verified creator" title={title} className="inline-flex shrink-0">
      <CheckCircle2
        aria-hidden
        style={{ width: size, height: size }}
        className={cn("text-amber-400", className)}
      />
    </span>
  );
}
