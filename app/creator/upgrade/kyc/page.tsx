"use client";

import { useEffect, useState } from "react";
import { ArrowLeft } from "@/lib/icons";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { KycStatusCard } from "@/components/kyc/kyc-status-card";
import Link from "next/link";
import { getAuthBootstrap } from "@/lib/auth-bootstrap-client";

export default function KYCPage() {
  const [currentUser, setCurrentUser] = useState<{
    username: string;
    role: "fan" | "creator";
    avatar?: string;
  } | null>(null);

  useEffect(() => {
    getAuthBootstrap().then((bootstrap) => {
      if (bootstrap.authenticated && bootstrap.profile) {
        setCurrentUser({
          username: bootstrap.profile.display_name || "user",
          role: (bootstrap.profile.role || "fan") as "fan" | "creator",
          avatar: bootstrap.profile.avatar_url || undefined,
        });
      }
    });
  }, []);

  return (
    <PageShell user={currentUser} notificationCount={0} maxWidth="2xl">
      <div className="section-block py-6">
        <Button asChild variant="ghost" size="sm" className="mb-6">
          <Link href="/creator/upgrade">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Link>
        </Button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-text-primary mb-2">Creator Verification</h1>
          <p className="text-text-secondary">
            Complete identity verification to unlock your creator account
          </p>
        </div>

        <KycStatusCard />

        <div className="mt-6 card-block p-5 bg-white/[0.02]">
          <h4 className="text-sm font-medium text-text-primary mb-2">How it works</h4>
          <ol className="text-sm text-text-secondary space-y-2 list-decimal list-inside">
            <li>Click &quot;Start Verification&quot; to begin the secure identity check</li>
            <li>Follow the on-screen instructions to scan your ID and complete a selfie</li>
            <li>Verification is usually completed within minutes</li>
            <li>Once approved, your creator account will be activated</li>
          </ol>
          <p className="text-xs text-text-tertiary mt-3">
            Your information is processed securely by our identity verification partner, Didit. We
            never store raw identity documents on our servers.
          </p>
        </div>
      </div>
    </PageShell>
  );
}
