"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Home, Search, Plus, Bell, User } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { startRouteTransition } from "@/lib/perf-client";

interface BottomNavigationProps {
  notificationCount?: number;
  userRole?: "fan" | "creator";
}

export function BottomNavigation({ notificationCount = 0, userRole }: BottomNavigationProps) {
  const pathname = usePathname();
  const router = useRouter();

  const navItems = [
    { href: "/home", label: "Home", icon: Home, testId: "bottom-nav-home" },
    { href: "/search", label: "Search", icon: Search, testId: "bottom-nav-search" },
    {
      href: "/creator/new-post",
      label: "Create",
      icon: Plus,
      testId: "bottom-nav-new-post",
      requireCreator: true,
    },
    {
      href: "/notifications",
      label: "Alerts",
      icon: Bell,
      testId: "bottom-nav-notifications",
      badge: notificationCount > 0 ? notificationCount : undefined,
    },
    { href: "/me", label: "Profile", icon: User, testId: "bottom-nav-profile" },
  ];

  const visibleItems = navItems.filter((item) => !item.requireCreator || userRole === "creator");

  useEffect(() => {
    visibleItems.forEach((item) => router.prefetch(item.href));
  }, [router, visibleItems]);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 glass-nav border-t border-white/6 md:hidden"
      role="navigation"
      aria-label="Main navigation"
      style={{ zIndex: "var(--z-bottom-nav)" as unknown as number }}
    >
      <div
        className="flex items-center justify-around px-1"
        style={{ height: "60px", paddingBottom: "env(safe-area-inset-bottom)" }}
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
                "focus-visible:outline-none",
                "active:scale-95",
                isActive ? "text-violet-500" : "text-text-muted hover:text-text-secondary"
              )}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
              data-testid={item.testId}
            >
              {/* Active indicator */}
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-6 rounded-full bg-violet-500" />
              )}

              <div className="relative">
                <Icon
                  className={cn(
                    "size-[20px]",
                    isActive && "drop-shadow-[0_0_6px_rgba(139,92,246,0.5)]"
                  )}
                  aria-hidden="true"
                />
                {item.badge && (
                  <span
                    className="absolute -top-1.5 -right-2 h-[16px] min-w-[16px] flex items-center justify-center rounded-full bg-violet-500 text-white text-[9px] font-bold px-0.5"
                    aria-label={`${item.badge} unread`}
                  >
                    {item.badge > 9 ? "9+" : item.badge}
                  </span>
                )}
              </div>

              <span className={cn("text-[10px] font-medium", isActive ? "text-violet-500" : "")}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
