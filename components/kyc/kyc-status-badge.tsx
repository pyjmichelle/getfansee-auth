"use client";

import { Badge } from "@/components/ui/badge";
import type { KycStatus } from "@/lib/kyc/kyc-status";
import { getKycStatusMeta } from "@/lib/kyc/kyc-status";

const VARIANT_MAP: Record<
  string,
  "default" | "success" | "warning" | "destructive" | "secondary" | "outline"
> = {
  default: "default",
  secondary: "secondary",
  destructive: "destructive",
  outline: "outline",
  success: "success",
  warning: "warning",
};

interface KycStatusBadgeProps {
  status: KycStatus;
  className?: string;
}

export function KycStatusBadge({ status, className }: KycStatusBadgeProps) {
  const meta = getKycStatusMeta(status);
  const variant = VARIANT_MAP[meta.badgeVariant] ?? "default";

  return (
    <Badge variant={variant} className={className}>
      {meta.label}
    </Badge>
  );
}
