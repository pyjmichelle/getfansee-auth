"use client";

import { NavHeader } from "@/components/nav-header";
import { BottomNavigation } from "@/components/bottom-navigation";
import { cn } from "@/lib/utils";

type MaxWidth = "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl" | "6xl" | "full";

interface PageShellProps {
  children: React.ReactNode;
  user?: {
    username: string;
    role: "fan" | "creator";
    avatar?: string;
  } | null;
  notificationCount?: number;
  maxWidth?: MaxWidth;
  className?: string;
  mainClassName?: string;
  noPadding?: boolean;
  meshBg?: boolean;
  /** When the page has its own fixed bottom action bar, suppress the shared BottomNavigation on mobile */
  hideBottomNav?: boolean;
}

const maxWidthMap: Record<MaxWidth, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
  full: "max-w-full",
};

export function PageShell({
  children,
  user,
  notificationCount = 0,
  maxWidth = "4xl",
  className,
  mainClassName,
  noPadding = false,
  meshBg = false,
  hideBottomNav = false,
}: PageShellProps) {
  return (
    <div className={cn("min-h-dvh bg-bg-base flex flex-col", meshBg && "mesh-bg", className)}>
      <NavHeader user={user ?? undefined} notificationCount={notificationCount} />
      <main
        className={cn(
          "flex-1 pt-4 md:pt-6 md:pb-8",
          /* When page has its own fixed action bar, don't add bottom padding for BottomNavigation */
          hideBottomNav ? "pb-6" : "pb-24",
          !noPadding && [maxWidthMap[maxWidth], "mx-auto px-4 md:px-6"],
          mainClassName
        )}
      >
        {children}
      </main>
      {!hideBottomNav && (
        <BottomNavigation notificationCount={notificationCount} userRole={user?.role} />
      )}
    </div>
  );
}
