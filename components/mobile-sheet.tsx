"use client";

import { X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MobileSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  showHandle?: boolean;
  showCloseButton?: boolean;
  children: React.ReactNode;
  className?: string;
}

/**
 * MobileSheet - Figma Make style bottom sheet for mobile
 *
 * Features:
 * - Drag handle indicator
 * - Optional title with close button
 * - Slide up animation
 * - Safe area bottom padding
 */
export function MobileSheet({
  open,
  onOpenChange,
  title,
  showHandle = true,
  showCloseButton = true,
  children,
  className,
}: MobileSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className={cn(
          "h-auto max-h-[90vh] rounded-t-2xl bg-card border-t border-border p-0 overflow-hidden",
          className
        )}
      >
        {/* Handle */}
        {showHandle && (
          <div className="flex justify-center py-3">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
          </div>
        )}

        {/* Header */}
        {(title || showCloseButton) && (
          <SheetHeader className="flex flex-row items-center justify-between px-4 pb-4">
            {title && (
              <SheetTitle className="text-lg font-semibold text-foreground">{title}</SheetTitle>
            )}
            {showCloseButton && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onOpenChange(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </Button>
            )}
          </SheetHeader>
        )}

        {/* Content */}
        <div className="px-4 pb-4 safe-area-bottom overflow-y-auto">{children}</div>
      </SheetContent>
    </Sheet>
  );
}

/**
 * MobileSheetItem - List item for mobile sheet menus
 */
interface MobileSheetItemProps {
  icon?: React.ReactNode;
  label: string;
  description?: string;
  onClick?: () => void;
  href?: string;
  destructive?: boolean;
  className?: string;
}

export function MobileSheetItem({
  icon,
  label,
  description,
  onClick,
  href,
  destructive = false,
  className,
}: MobileSheetItemProps) {
  const content = (
    <>
      {icon && (
        <div
          className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center",
            destructive ? "bg-destructive-muted text-destructive" : "bg-muted text-foreground"
          )}
        >
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className={cn("font-medium", destructive ? "text-destructive" : "text-foreground")}>
          {label}
        </p>
        {description && <p className="text-sm text-muted-foreground truncate">{description}</p>}
      </div>
    </>
  );

  const baseClassName = cn(
    "flex items-center gap-3 w-full p-3 rounded-xl transition-colors",
    "hover:bg-muted active:bg-muted/80",
    className
  );

  if (href) {
    return (
      <a href={href} className={baseClassName}>
        {content}
      </a>
    );
  }

  return (
    <button onClick={onClick} className={baseClassName}>
      {content}
    </button>
  );
}
