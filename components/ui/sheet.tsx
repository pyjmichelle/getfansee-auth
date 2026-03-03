"use client";

import * as React from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { XIcon } from "@/lib/icons";

import { cn } from "@/lib/utils";

function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger({ ...props }: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose({ ...props }: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetPortal({ ...props }: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 bg-black/70 backdrop-blur-sm",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        "duration-200",
        className
      )}
      style={{ zIndex: "var(--z-sheet)" as unknown as number }}
      {...props}
    />
  );
}

function SheetContent({
  className,
  children,
  side = "bottom",
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: "top" | "right" | "bottom" | "left";
}) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          "glass-panel fixed flex flex-col shadow-2xl",
          "transition ease-in-out",
          "data-[state=closed]:duration-250 data-[state=open]:duration-350",
          side === "bottom" && [
            "inset-x-0 bottom-0",
            "rounded-t-[var(--radius-lg)]",
            "border-t border-white/8",
            "max-h-[90dvh]",
            "pb-[env(safe-area-inset-bottom)]",
            "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
          ],
          side === "top" && [
            "inset-x-0 top-0",
            "rounded-b-[var(--radius-lg)]",
            "border-b border-white/8",
            "data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
          ],
          side === "right" && [
            "inset-y-0 right-0 h-full w-[85vw] max-w-sm",
            "rounded-l-[var(--radius-lg)]",
            "border-l border-white/8",
            "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
          ],
          side === "left" && [
            "inset-y-0 left-0 h-full w-[85vw] max-w-sm",
            "rounded-r-[var(--radius-lg)]",
            "border-r border-white/8",
            "data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left",
          ],
          className
        )}
        style={{ zIndex: "var(--z-sheet)" as unknown as number }}
        {...props}
      >
        {/* drag handle for bottom sheet */}
        {side === "bottom" && (
          <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
            <div className="w-10 h-1 rounded-full bg-white/20" />
          </div>
        )}
        {children}
        <SheetPrimitive.Close
          className={cn(
            "absolute top-4 right-4",
            "size-6 rounded-[var(--radius-xs)]",
            "flex items-center justify-center",
            "text-white/40 hover:text-white hover:bg-white/10",
            "transition-colors duration-150",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-500/40"
          )}
        >
          <XIcon className="size-3.5" />
          <span className="sr-only">Close</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-1 px-4 pt-2 pb-3 border-b border-white/6", className)}
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4 border-t border-white/6", className)}
      {...props}
    />
  );
}

function SheetTitle({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("text-[14px] font-semibold text-white leading-tight", className)}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-text-muted text-[12px]", className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
