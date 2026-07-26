"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Shield,
  FileText,
  UserCheck,
  Flag,
  LayoutDashboard,
  Users,
  DollarSign,
  ExternalLink,
} from "@/lib/icons";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/creator-verifications", label: "KYC Reviews", icon: UserCheck },
  { href: "/admin/content-review", label: "Content Review", icon: FileText },
  { href: "/admin/creator-links", label: "Link Reviews", icon: ExternalLink },
  { href: "/admin/reports", label: "Reports", icon: Flag },
  { href: "/admin/referrals", label: "Referrals", icon: Users },
  { href: "/admin/commissions", label: "Commissions", icon: DollarSign },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex w-60 min-h-dvh bg-[var(--bg-surface)] border-r border-[var(--border-subtle)] flex-col shrink-0">
      {/* Header */}
      <div className="h-16 flex items-center gap-3 px-5 border-b border-border-base">
        <div className="w-8 h-8 rounded-lg bg-error/10 flex items-center justify-center">
          <Shield className="w-4 h-4 text-error" aria-hidden="true" />
        </div>
        <div>
          <p className="text-small font-semibold text-text-primary">Admin Panel</p>
          <p className="text-tiny text-text-tertiary">GetFanSee</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1" aria-label="Admin navigation">
        {navItems.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : (pathname?.startsWith(item.href) ?? false);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-small font-medium min-h-[44px] transition-all active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-brand-primary",
                isActive
                  ? "bg-brand-primary/10 text-wine-text"
                  : "text-text-tertiary hover:bg-surface-raised hover:text-text-primary"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-border-base">
        <Link
          href="/home"
          className="text-tiny text-text-tertiary hover:text-wine-text transition-colors focus-visible:outline-2 focus-visible:outline-brand-primary"
        >
          ← Back to Site
        </Link>
      </div>
    </aside>
  );
}

/**
 * Mobile-only horizontal quick-nav (<lg). The desktop sidebar is hidden below
 * the lg breakpoint, which previously left mobile admin users with zero
 * in-app navigation between admin sections.
 */
export function AdminMobileNav() {
  const pathname = usePathname();

  return (
    <nav
      className="lg:hidden -mx-4 px-4 flex gap-2 overflow-x-auto pb-3 mb-4 no-scrollbar border-b border-border-subtle"
      aria-label="Admin navigation"
    >
      {navItems.map((item) => {
        const isActive = item.exact
          ? pathname === item.href
          : (pathname?.startsWith(item.href) ?? false);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-1.5 shrink-0 px-3 py-2 rounded-full text-small font-medium whitespace-nowrap transition-colors min-h-[40px]",
              isActive
                ? "bg-[var(--wine)] text-text-primary"
                : "bg-[var(--bg-surface)] text-text-secondary hover:text-text-primary"
            )}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon className="size-[15px]" aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
