import type React from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminSidebar, AdminMobileNav } from "@/components/admin/admin-sidebar";
import { requireAdmin } from "@/lib/authz";

export const metadata: Metadata = {
  title: "Admin Panel - GetFanSee",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireAdmin();
  } catch {
    redirect("/auth?next=/admin");
  }

  return (
    <div className="min-h-dvh bg-[var(--bg-base)] flex">
      <AdminSidebar />
      <main className="flex-1 overflow-auto min-w-0">
        <div className="max-w-6xl mx-auto p-6 md:p-8">
          <AdminMobileNav />
          {children}
        </div>
      </main>
    </div>
  );
}
