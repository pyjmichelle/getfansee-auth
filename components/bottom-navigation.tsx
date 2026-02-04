"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, Plus, Bell, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface BottomNavigationProps {
  notificationCount?: number;
  userRole?: "fan" | "creator";
}

/**
 * BottomNavigation - 移动端底部导航栏
 * 仅在移动端显示（< 768px）
 * 符合 building-native-ui 和 web-design-guidelines
 */
export function BottomNavigation({ notificationCount = 0, userRole }: BottomNavigationProps) {
  const pathname = usePathname();

  const navItems = [
    {
      href: "/home",
      label: "Home",
      icon: Home,
      testId: "bottom-nav-home",
    },
    {
      href: "/search",
      label: "Search",
      icon: Search,
      testId: "bottom-nav-search",
    },
    {
      href: "/creator/new-post",
      label: "New Post",
      icon: Plus,
      testId: "bottom-nav-new-post",
      requireCreator: true,
    },
    {
      href: "/notifications",
      label: "Notifications",
      icon: Bell,
      testId: "bottom-nav-notifications",
      badge: notificationCount > 0 ? notificationCount : undefined,
    },
    {
      href: "/me",
      label: "Profile",
      icon: User,
      testId: "bottom-nav-profile",
    },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 glass-strong border-t border-border md:hidden"
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="flex items-center justify-around h-[60px] safe-area-inset-bottom">
        {navItems
          .filter((item) => !item.requireCreator || userRole === "creator")
          .map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 min-w-[56px] min-h-[44px] px-2 py-1.5 rounded-xl",
                  "transition-[color,background-color,transform] duration-150 motion-safe:transition-[color,background-color,transform] motion-reduce:transition-none",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                  "active:scale-95",
                  isActive
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                )}
                aria-label={item.label}
                aria-current={isActive ? "page" : undefined}
                data-testid={item.testId}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    window.location.href = item.href;
                  }
                }}
              >
                <div className="relative">
                  <Icon
                    className={cn(
                      "w-5 h-5 transition-transform duration-150",
                      isActive && "scale-105 text-primary"
                    )}
                    aria-hidden="true"
                  />
                  {item.badge && (
                    <Badge
                      variant="destructive"
                      className="absolute -top-1.5 -right-2 h-4 w-4 flex items-center justify-center p-0 text-[10px]"
                      aria-label={`${item.badge} unread notifications`}
                    >
                      {item.badge > 9 ? "9+" : item.badge}
                    </Badge>
                  )}
                </div>
                <span className={cn("text-[10px] font-medium", isActive && "text-primary")}>
                  {item.label}
                </span>
              </Link>
            );
          })}
      </div>
    </nav>
  );
}
