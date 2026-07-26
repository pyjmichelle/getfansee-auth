"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { UserCheck, FileText, Flag, ArrowRight, Shield } from "@/lib/icons";
import Link from "next/link";
import { useCountUp } from "@/hooks/use-count-up";
import { useAuth } from "@/contexts/auth-context";
import { useSkeletonMetric } from "@/hooks/use-skeleton-metric";

export default function AdminDashboardPage() {
  const router = useRouter();
  const auth = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [pendingKyc, setPendingKyc] = useState(0);
  const [pendingReports, setPendingReports] = useState(0);
  useSkeletonMetric("admin_dashboard_page", isLoading);

  useEffect(() => {
    const load = async () => {
      if (!auth.authenticated || !auth.user) {
        router.push("/auth");
        return;
      }
      if (auth.profile?.role !== "admin") {
        router.push("/home");
        return;
      }
      try {
        const [kycRes, reportsRes] = await Promise.all([
          fetch("/api/admin/kyc"),
          fetch("/api/admin/reports"),
        ]);

        if (kycRes.ok) {
          const d = await kycRes.json();
          setPendingKyc((d.verifications || []).length);
        }
        if (reportsRes.ok) {
          const d = await reportsRes.json();
          setPendingReports((d.reports || []).length);
        }
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [router, auth.authenticated, auth.user, auth.profile]);

  const animatedKyc = useCountUp(pendingKyc, { duration: 800, decimals: 0 });
  const animatedReports = useCountUp(pendingReports, { duration: 800, decimals: 0 });

  const cards = [
    {
      href: "/admin/creator-verifications",
      icon: UserCheck,
      label: "KYC Reviews",
      description: "Pending creator identity verifications",
      count: animatedKyc,
      rawCount: pendingKyc,
      color: "text-wine-text",
      bg: "bg-[var(--wine)]/10",
    },
    {
      href: "/admin/content-review",
      icon: FileText,
      label: "Content Review",
      description: "Recently published content",
      count: null,
      rawCount: null,
      color: "text-[var(--info)]",
      bg: "bg-[var(--info)]/10",
    },
    {
      href: "/admin/reports",
      icon: Flag,
      label: "Reports",
      description: "Pending user reports",
      count: animatedReports,
      rawCount: pendingReports,
      color: "text-[var(--error-text)]",
      bg: "bg-[var(--error)]/10",
    },
  ];

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4 max-w-3xl">
        <div className="h-8 bg-surface-raised rounded-xl w-48" />
        <div className="grid md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-36 bg-surface-raised rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Hero */}
      <div className="card-block bg-gradient-subtle p-6 md:p-8 mb-8">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-12 h-12 bg-[var(--wine)]/10 rounded-xl flex items-center justify-center">
            <Shield className="w-6 h-6 text-wine-text" />
          </div>
          <div>
            <h1 className="text-h1 font-bold text-text-primary">Admin Dashboard</h1>
            <p className="text-text-secondary">Manage platform operations and moderation</p>
          </div>
        </div>
      </div>

      {/* Bento Stats */}
      <div className="bento-grid mb-8">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.href} href={card.href} className="card-block p-6 hover-bold group">
              <div
                className={`w-12 h-12 ${card.bg} rounded-xl flex items-center justify-center mb-4`}
              >
                <Icon className={`w-6 h-6 ${card.color}`} />
              </div>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-text-primary mb-1">{card.label}</h3>
                  <p className="text-tiny text-text-tertiary">{card.description}</p>
                </div>
                {card.rawCount !== null && card.rawCount > 0 && (
                  <span className="ml-2 shrink-0 px-2 py-0.5 bg-error/10 text-error text-tiny font-bold rounded-lg">
                    {card.count?.toFixed(0)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 mt-4 text-tiny text-text-tertiary group-hover:text-wine-text transition-colors">
                <span>View all</span>
                <ArrowRight className="w-3 h-3" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
