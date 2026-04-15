"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Shield, Loader2, RefreshCw, ArrowRight } from "@/lib/icons";
import type { KycStatus } from "@/lib/kyc/kyc-status";
import { getKycStatusMeta } from "@/lib/kyc/kyc-status";

interface KycVerificationButtonProps {
  status: KycStatus;
  onStartVerification: () => Promise<void>;
  disabled?: boolean;
  className?: string;
}

export function KycVerificationButton({
  status,
  onStartVerification,
  disabled,
  className,
}: KycVerificationButtonProps) {
  const [loading, setLoading] = useState(false);
  const meta = getKycStatusMeta(status);

  const handleClick = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      await onStartVerification();
    } finally {
      setLoading(false);
    }
  }, [loading, onStartVerification]);

  if (!meta.canStartVerification && !meta.canRetry && !meta.canContinue) {
    if (meta.isPending) {
      return (
        <Button disabled className={className} variant="outline" size="lg">
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          {meta.label === "Under Review" ? "Verification Under Review" : "Verification Pending"}
        </Button>
      );
    }
    if (meta.isTerminal && meta.label === "Verified") {
      return (
        <Button disabled className={className} variant="outline" size="lg">
          <Shield className="w-4 h-4 mr-2" />
          Identity Verified
        </Button>
      );
    }
    return null;
  }

  let label: string;
  let icon: React.ReactNode;

  if (meta.canStartVerification) {
    label = "Start Verification";
    icon = <Shield className="w-4 h-4 mr-2" />;
  } else if (meta.canContinue) {
    label = "Continue Verification";
    icon = <ArrowRight className="w-4 h-4 mr-2" />;
  } else {
    label = "Retry Verification";
    icon = <RefreshCw className="w-4 h-4 mr-2" />;
  }

  return (
    <Button
      onClick={handleClick}
      disabled={disabled || loading}
      className={className}
      variant="default"
      size="lg"
    >
      {loading ? <Loader2 className="w-4 h-4 mr-2" /> : icon}
      {loading ? "Preparing..." : label}
    </Button>
  );
}
