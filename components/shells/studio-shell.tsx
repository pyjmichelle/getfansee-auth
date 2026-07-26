"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Plus,
  DollarSign,
  Users,
  Eye,
  BarChart3,
  ExternalLink,
  Heart,
  LayoutDashboard,
  Gift,
} from "@/lib/icons";
import { cn } from "@/lib/utils";

const STUDIO_NAV = [
  { href: "/creator/studio", icon: LayoutDashboard, label: "Overview", exact: true },
  { href: "/creator/new-post", icon: Plus, label: "Create Post" },
  { href: "/creator/studio/earnings", icon: DollarSign, label: "Earnings" },
  { href: "/creator/studio/subscribers", icon: Users, label: "Subscribers" },
  { href: "/creator/studio/tips", icon: Heart, label: "Tips" },
  { href: "/creator/studio/post/list", icon: Eye, label: "Post List" },
  { href: "/creator/studio/analytics", icon: BarChart3, label: "Analytics" },
  { href: "/creator/studio/links", icon: ExternalLink, label: "Profile & Links" },
  { href: "/creator/studio/ambassador", icon: Gift, label: "Ambassador" },
];

interface StudioShellProps {
  children: React.ReactNode;
  /** Suppress the sidebar entirely (rarely needed — e.g. full-bleed editors). */
  hideSidebar?: boolean;
  /** Extra content rendered below the nav in the desktop sidebar (e.g. page-specific quick actions). */
  sidebarExtra?: React.ReactNode;
}

/**
 * Shared Creator Studio workspace shell (T5 in the site-wide refactor plan).
 * Unifies the sidebar nav (7 items, w-64, wine active state, sticky) that was
 * previously re-implemented independently — and inconsistently — across 7
 * studio sub-pages. Adds active-state highlighting and a mobile horizontal
 * quick-nav that previously didn't exist on most sub-pages.
 */
export function StudioShell({ children, hideSidebar = false, sidebarExtra }: StudioShellProps) {
  const pathname = usePathname();

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname?.startsWith(href + "/");

  return (
    <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
      {/* Mobile: horizontal quick-nav */}
      {!hideSidebar && (
        <nav
          data-testid="creator-nav"
          className="lg:hidden -mx-4 px-4 flex gap-2 overflow-x-auto pb-1 no-scrollbar"
          aria-label="Studio navigation"
        >
          {STUDIO_NAV.map(({ href, icon: Icon, label, exact }) => {
            const active = isActive(href, exact);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-1.5 shrink-0 px-3 py-2 rounded-full text-small font-medium whitespace-nowrap transition-colors",
                  "min-h-[40px]",
                  active
                    ? "bg-[var(--wine)] text-text-primary"
                    : "bg-[var(--bg-surface)] text-text-secondary hover:text-text-primary"
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="size-[15px]" aria-hidden="true" />
                {label}
              </Link>
            );
          })}
        </nav>
      )}

      <div className="flex-1 min-w-0">{children}</div>

      {/* Desktop: sticky sidebar */}
      {!hideSidebar && (
        <aside
          data-testid="creator-nav"
          className="hidden lg:block w-64 shrink-0"
          aria-label="Studio navigation"
        >
          <div className="sticky top-24 space-y-3">
            <div className="card-block p-4">
              <h2 className="text-tiny font-semibold text-text-muted uppercase tracking-wider mb-3">
                Studio
              </h2>
              <nav className="space-y-1">
                {STUDIO_NAV.map(({ href, icon: Icon, label, exact }) => {
                  const active = isActive(href, exact);
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-xl text-small font-medium transition-all",
                        "active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wine)]",
                        active
                          ? "bg-[var(--wine-tint)] text-text-primary"
                          : "text-text-secondary hover:bg-surface-raised hover:text-text-primary"
                      )}
                      aria-current={active ? "page" : undefined}
                    >
                      <Icon size={16} aria-hidden="true" />
                      {label}
                    </Link>
                  );
                })}
              </nav>
            </div>
            {sidebarExtra}
          </div>
        </aside>
      )}
    </div>
  );
}
