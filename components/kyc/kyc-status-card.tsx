"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import {
  Shield,
  Clock,
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  AlertCircle,
  ArrowRight,
} from "@/lib/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { KycStatusBadge } from "./kyc-status-badge";
import { KycVerificationButton } from "./kyc-verification-button";
import { KYC_STATUS, type KycStatus, getKycStatusMeta } from "@/lib/kyc/kyc-status";
import { toast } from "sonner";

interface KycStatusCardProps {
  className?: string;
  onStatusChange?: (status: KycStatus) => void;
  approvedHref?: string;
}

interface KycApiResponse {
  success: boolean;
  status: KycStatus;
  displayStatus: string;
  message: string;
  canRetry: boolean;
  canContinue: boolean;
  canStart: boolean;
  sessionId: string | null;
  verificationUrl: string | null;
  decidedAt: string | null;
}

const STATUS_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  [KYC_STATUS.NOT_STARTED]: Shield,
  [KYC_STATUS.INITIATED]: Clock,
  [KYC_STATUS.IN_PROGRESS]: Loader2,
  [KYC_STATUS.SUBMITTED]: Clock,
  [KYC_STATUS.APPROVED]: CheckCircle,
  [KYC_STATUS.DECLINED]: XCircle,
  [KYC_STATUS.EXPIRED]: AlertTriangle,
  [KYC_STATUS.RESUBMISSION_REQUIRED]: AlertTriangle,
  [KYC_STATUS.ERROR]: AlertCircle,
};

const STATUS_ICON_COLOR: Record<string, string> = {
  [KYC_STATUS.NOT_STARTED]: "text-brand-primary",
  [KYC_STATUS.INITIATED]: "text-amber-400",
  [KYC_STATUS.IN_PROGRESS]: "text-amber-400",
  [KYC_STATUS.SUBMITTED]: "text-amber-400",
  [KYC_STATUS.APPROVED]: "text-emerald-400",
  [KYC_STATUS.DECLINED]: "text-red-400",
  [KYC_STATUS.EXPIRED]: "text-amber-400",
  [KYC_STATUS.RESUBMISSION_REQUIRED]: "text-amber-400",
  [KYC_STATUS.ERROR]: "text-red-400",
};

const STATUS_BG_COLOR: Record<string, string> = {
  [KYC_STATUS.NOT_STARTED]: "bg-brand-primary/10",
  [KYC_STATUS.INITIATED]: "bg-amber-500/10",
  [KYC_STATUS.IN_PROGRESS]: "bg-amber-500/10",
  [KYC_STATUS.SUBMITTED]: "bg-amber-500/10",
  [KYC_STATUS.APPROVED]: "bg-emerald-500/10",
  [KYC_STATUS.DECLINED]: "bg-red-500/10",
  [KYC_STATUS.EXPIRED]: "bg-amber-500/10",
  [KYC_STATUS.RESUBMISSION_REQUIRED]: "bg-amber-500/10",
  [KYC_STATUS.ERROR]: "bg-red-500/10",
};

export function KycStatusCard({ className, onStatusChange, approvedHref }: KycStatusCardProps) {
  const [data, setData] = useState<KycApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevStatusRef = useRef<KycStatus | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/kyc/status");
      if (!res.ok) return;
      const json = (await res.json()) as KycApiResponse;
      setData(json);
      if (
        onStatusChange &&
        prevStatusRef.current !== null &&
        prevStatusRef.current !== json.status
      ) {
        onStatusChange(json.status);
      }
      prevStatusRef.current = json.status;
    } catch {
      // Silently fail — will retry on next poll
    } finally {
      setLoading(false);
    }
  }, [onStatusChange]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Poll while in non-terminal states
  useEffect(() => {
    if (!data) return;
    const meta = getKycStatusMeta(data.status);
    if (meta.isPending) {
      pollRef.current = setInterval(fetchStatus, 5000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [data, fetchStatus]);

  const handleStartVerification = useCallback(async () => {
    try {
      const res = await fetch("/api/kyc/session", { method: "POST" });
      const json = await res.json();

      if (!res.ok || !json.success) {
        toast.error(json.message ?? "Failed to start verification. Please try again.");
        return;
      }

      // Use Didit SDK if available, otherwise redirect
      if (json.verificationUrl) {
        try {
          const { DiditSdk } = await import("@didit-protocol/sdk-web");

          DiditSdk.shared.onComplete = (result: { type: string }) => {
            if (result.type === "completed" || result.type === "dismissed") {
              fetchStatus();
            }
          };

          DiditSdk.shared.startVerification({ url: json.verificationUrl });
        } catch {
          // SDK not available — fall back to redirect
          window.location.href = json.verificationUrl;
        }
      }

      // Refresh status after initiating
      setTimeout(fetchStatus, 1000);
    } catch {
      toast.error("Unable to connect. Please check your internet and try again.");
    }
  }, [fetchStatus]);

  const status = data?.status ?? KYC_STATUS.NOT_STARTED;
  const meta = getKycStatusMeta(status);
  const IconComponent = STATUS_ICON_MAP[status] ?? Shield;
  const iconColor = STATUS_ICON_COLOR[status] ?? "text-brand-primary";
  const bgColor = STATUS_BG_COLOR[status] ?? "bg-brand-primary/10";

  return (
    <div className={cn("card-block p-6 min-h-[280px] flex flex-col", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-text-primary">Identity Verification</h3>
        {status !== KYC_STATUS.NOT_STARTED && <KycStatusBadge status={status} />}
      </div>

      {/* Content — flex-1 keeps the card height stable */}
      <div className="flex-1 flex flex-col items-center justify-center text-center px-2">
        {loading ? (
          <Loader2 className="w-8 h-8 text-text-tertiary mb-4" />
        ) : (
          <>
            <div
              className={cn(
                "w-14 h-14 rounded-full flex items-center justify-center mb-4",
                bgColor
              )}
            >
              <IconComponent className={cn("w-7 h-7", iconColor)} />
            </div>
            <p className="text-sm text-text-secondary max-w-md leading-relaxed">
              {meta.description}
            </p>
            {status === KYC_STATUS.APPROVED && (
              <p className="text-xs text-emerald-500 mt-2 font-medium">
                Your creator account is now active.
              </p>
            )}
          </>
        )}
      </div>

      {/* Action — fixed height bottom area */}
      <div className="mt-4 flex justify-center min-h-[48px]">
        {!loading && status === KYC_STATUS.APPROVED && approvedHref ? (
          <Button
            asChild
            variant="default"
            size="lg"
            className="w-full sm:w-auto text-white shadow-glow hover-bold"
          >
            <a href={approvedHref}>
              Continue Setup <ArrowRight className="w-4 h-4 ml-2" />
            </a>
          </Button>
        ) : !loading ? (
          <KycVerificationButton
            status={status}
            onStartVerification={handleStartVerification}
            className="w-full sm:w-auto text-white shadow-glow hover-bold"
          />
        ) : null}
      </div>
    </div>
  );
}
