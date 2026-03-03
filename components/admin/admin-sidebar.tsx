"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shield, FileText, UserCheck, Flag, LayoutDashboard } from "@/lib/icons";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/creator-verifications", label: "KYC Reviews", icon: UserCheck },
  { href: "/admin/content-review", label: "Content Review", icon: FileText },
  { href: "/admin/reports", label: "Reports", icon: Flag },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 min-h-screen bg-surface-base border-r border-border-base flex flex-col shrink-0">
      {/* Header */}
      <div className="h-16 flex items-center gap-3 px-5 border-b border-border-base">
        <div className="w-8 h-8 rounded-lg bg-error/10 flex items-center justify-center">
          <Shield className="w-4 h-4 text-error" aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm font-semibold text-text-primary">Admin Panel</p>
          <p className="text-xs text-text-tertiary">GetFanSee</p>
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
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium min-h-[44px] transition-all active:scale-95 focus-visible:outline-2 focus-visible:outline-brand-primary",
                isActive
                  ? "bg-brand-primary/10 text-brand-primary"
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
          className="text-xs text-text-tertiary hover:text-brand-primary transition-colors focus-visible:outline-2 focus-visible:outline-brand-primary"
        >
          ← Back to Site
        </Link>
      </div>
    </aside>
  );
}
