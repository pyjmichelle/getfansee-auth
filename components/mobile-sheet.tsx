"use client";

import { X } from "@/lib/icons";
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
          "h-auto max-h-[90vh] rounded-t-2xl bg-surface-base border-t border-border-base p-0 overflow-hidden",
          className
        )}
      >
        {/* Handle */}
        {showHandle && (
          <div className="flex justify-center py-3" aria-hidden="true">
            <div className="w-10 h-1 rounded-full bg-border-strong" />
          </div>
        )}

        {/* Header */}
        {(title || showCloseButton) && (
          <SheetHeader className="flex flex-row items-center justify-between px-4 pb-4">
            {title && (
              <SheetTitle className="text-lg font-semibold text-text-primary">{title}</SheetTitle>
            )}
            {showCloseButton && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onOpenChange(false)}
                className="text-text-tertiary hover:text-text-primary hover:bg-surface-raised active:scale-95 transition-all min-h-[44px] min-w-[44px] focus-visible:ring-2 focus-visible:ring-brand-primary"
                aria-label="Close"
              >
                <X className="w-5 h-5" aria-hidden="true" />
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
            destructive ? "bg-error/10 text-error" : "bg-surface-raised text-text-primary"
          )}
          aria-hidden="true"
        >
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className={cn("font-medium", destructive ? "text-error" : "text-text-primary")}>
          {label}
        </p>
        {description && <p className="text-sm text-text-tertiary truncate">{description}</p>}
      </div>
    </>
  );

  const baseClassName = cn(
    "flex items-center gap-3 w-full p-3 rounded-xl transition-all min-h-[44px]",
    "hover:bg-surface-raised active:scale-95 focus-visible:outline-2 focus-visible:outline-brand-primary cursor-pointer",
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
    <button onClick={onClick} className={baseClassName} type="button">
      {content}
    </button>
  );
}
