"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DetailPageHeaderProps {
  /** Mobile fixed-header title (e.g. "Post", creator display name). */
  title: string;
  /** Optional right-side action shown on both mobile header and desktop row. */
  rightAction?: {
    icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
    label: string;
    onClick: () => void;
  };
  onBack?: () => void;
  className?: string;
}

/**
 * Shared detail-page header (T3 in the site-wide refactor plan): mobile fixed
 * back/title/action bar + desktop inline back row. Previously hand-rolled
 * independently in posts/[id] and creator/[id] with slightly different
 * markup, colors, and z-index handling.
 */
export function DetailPageHeader({ title, rightAction, onBack, className }: DetailPageHeaderProps) {
  const router = useRouter();
  const handleBack = onBack ?? (() => router.back());
  const RightIcon = rightAction?.icon;

  return (
    <div className={className}>
      {/* Mobile-only fixed header */}
      <header
        className="fixed top-0 left-0 right-0 glass-strong border-b border-border-subtle md:hidden"
        style={{ zIndex: "var(--z-nav)" as unknown as number }}
      >
        <div className="flex items-center justify-between px-4 h-14 max-w-3xl mx-auto">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleBack}
            aria-label="Go back"
            className="text-text-primary active:scale-[0.98]"
          >
            <ArrowLeft className="w-5 h-5" aria-hidden="true" />
          </Button>
          <h1 className="font-semibold text-text-primary truncate max-w-[60%]">{title}</h1>
          {RightIcon ? (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={rightAction.onClick}
              aria-label={rightAction.label}
              className="text-text-primary active:scale-[0.98]"
            >
              <RightIcon className="w-5 h-5" aria-hidden />
            </Button>
          ) : (
            <div className="size-8" aria-hidden="true" />
          )}
        </div>
      </header>

      {/* Desktop inline back row */}
      <div className="hidden md:flex items-center gap-3 mb-3">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleBack}
          aria-label="Go back"
          className={cn("text-text-muted hover:text-text-primary active:scale-[0.98]")}
        >
          <ArrowLeft className="w-5 h-5" aria-hidden="true" />
        </Button>
        <span className="text-small text-text-muted">Back</span>
        {RightIcon && (
          <div className="ml-auto">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={rightAction.onClick}
              aria-label={rightAction.label}
              className="text-text-muted hover:text-text-primary active:scale-[0.98]"
            >
              <RightIcon className="w-5 h-5" aria-hidden />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
