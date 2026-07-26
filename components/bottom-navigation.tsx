"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Home, Search, Plus, Bell, User } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { startRouteTransition } from "@/lib/perf-client";

const NAV_ROUTES = [
  { href: "/home", label: "Home", icon: Home, testId: "bottom-nav-home" },
  { href: "/search", label: "Search", icon: Search, testId: "bottom-nav-search" },
  {
    href: "/creator/new-post",
    label: "Create",
    icon: Plus,
    testId: "bottom-nav-new-post",
    requireCreator: true,
  },
  { href: "/notifications", label: "Alerts", icon: Bell, testId: "bottom-nav-notifications" },
  { href: "/me", label: "Profile", icon: User, testId: "bottom-nav-profile" },
];

interface BottomNavigationProps {
  notificationCount?: number;
  userRole?: "fan" | "creator";
}

export function BottomNavigation({ notificationCount = 0, userRole }: BottomNavigationProps) {
  const pathname = usePathname();
  const router = useRouter();

  const visibleItems = useMemo(
    () => NAV_ROUTES.filter((item) => !item.requireCreator || userRole === "creator"),
    [userRole]
  );

  useEffect(() => {
    visibleItems.forEach((item) => router.prefetch(item.href));
  }, [router, visibleItems]);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-[var(--bg-surface)]/95 backdrop-blur-md border-t border-[var(--border-subtle)] lg:hidden safe-area-bottom"
      role="navigation"
      aria-label="Main navigation"
      style={{ zIndex: "var(--z-bottom-nav)" as unknown as number }}
    >
      {/* The safe-area inset is padding on the OUTER <nav>, added on top of
          this fixed content height — not squeezed inside it. A border-box
          height that included the inset used to compress the touch targets
          down to a sliver on any notched/home-indicator device. */}
      <div
        className="flex items-center justify-around px-1"
        style={{ height: "var(--bottom-nav-height)" }}
      >
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== "/home" && pathname?.startsWith(item.href + "/"));

          return (
            <Link
              key={item.href}
              href={item.href}
              onMouseEnter={() => router.prefetch(item.href)}
              onTouchStart={() => router.prefetch(item.href)}
              onClick={() => startRouteTransition(item.href, pathname ?? undefined)}
              className={cn(
                "relative flex flex-col items-center justify-center gap-0.5",
                "flex-1 h-full py-2",
                "transition-[color,transform] duration-150",
                "focus-visible:outline-none focus-visible:ring-[1.5px] focus-visible:ring-[var(--wine)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--bg-surface)] focus-visible:rounded-[var(--radius-sm)]",
                "active:scale-[0.98]",
                isActive ? "text-wine-text" : "text-text-muted hover:text-text-secondary"
              )}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
              data-testid={item.testId}
            >
              {/* Active indicator */}
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-6 rounded-full bg-[var(--wine)]" />
              )}

              <div className="relative">
                <Icon className="size-[20px]" aria-hidden="true" />
                {item.href === "/notifications" && notificationCount > 0 && (
                  <span
                    className="absolute -top-1.5 -right-2 h-[16px] min-w-[16px] flex items-center justify-center rounded-full bg-[var(--wine)] text-text-primary text-[0.5625rem] font-bold px-0.5"
                    aria-label={`${notificationCount} unread`}
                  >
                    {notificationCount > 9 ? "9+" : notificationCount}
                  </span>
                )}
              </div>

              <span className={cn("text-[10px] font-medium", isActive ? "text-wine-text" : "")}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
