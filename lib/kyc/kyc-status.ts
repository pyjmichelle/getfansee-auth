/**
 * KYC Internal Status Definitions
 *
 * Single source of truth for all KYC status values,
 * display metadata, and allowed user actions.
 */

export const KYC_STATUS = {
  NOT_STARTED: "not_started",
  INITIATED: "initiated",
  IN_PROGRESS: "in_progress",
  SUBMITTED: "submitted",
  APPROVED: "approved",
  DECLINED: "declined",
  EXPIRED: "expired",
  RESUBMISSION_REQUIRED: "resubmission_required",
  ERROR: "error",
} as const;

export type KycStatus = (typeof KYC_STATUS)[keyof typeof KYC_STATUS];

export interface KycStatusMeta {
  label: string;
  description: string;
  badgeVariant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning";
  canStartVerification: boolean;
  canRetry: boolean;
  canContinue: boolean;
  isTerminal: boolean;
  isPending: boolean;
}

const STATUS_META: Record<KycStatus, KycStatusMeta> = {
  [KYC_STATUS.NOT_STARTED]: {
    label: "Not Started",
    description:
      "To protect creators, fans, and platform compliance, we need to verify your identity before your creator account can be approved.",
    badgeVariant: "secondary",
    canStartVerification: true,
    canRetry: false,
    canContinue: false,
    isTerminal: false,
    isPending: false,
  },
  [KYC_STATUS.INITIATED]: {
    label: "Pending",
    description:
      "You've started the verification process. Continue where you left off to complete your identity check.",
    badgeVariant: "warning",
    canStartVerification: false,
    canRetry: false,
    canContinue: true,
    isTerminal: false,
    isPending: true,
  },
  [KYC_STATUS.IN_PROGRESS]: {
    label: "In Progress",
    description: "Your identity verification is in progress. You can continue where you left off.",
    badgeVariant: "warning",
    canStartVerification: false,
    canRetry: false,
    canContinue: true,
    isTerminal: false,
    isPending: true,
  },
  [KYC_STATUS.SUBMITTED]: {
    label: "Under Review",
    description:
      "Your verification has been submitted and is being reviewed. We'll notify you once the review is complete.",
    badgeVariant: "warning",
    canStartVerification: false,
    canRetry: false,
    canContinue: false,
    isTerminal: false,
    isPending: true,
  },
  [KYC_STATUS.APPROVED]: {
    label: "Verified",
    description: "Your identity has been verified. You now have full access to creator features.",
    badgeVariant: "success",
    canStartVerification: false,
    canRetry: false,
    canContinue: false,
    isTerminal: true,
    isPending: false,
  },
  [KYC_STATUS.DECLINED]: {
    label: "Declined",
    description:
      "Your identity verification was not successful. You can start a new verification to try again.",
    badgeVariant: "destructive",
    canStartVerification: false,
    canRetry: true,
    canContinue: false,
    isTerminal: true,
    isPending: false,
  },
  [KYC_STATUS.EXPIRED]: {
    label: "Expired",
    description:
      "Your verification session has expired. Please start a new verification to continue.",
    badgeVariant: "warning",
    canStartVerification: false,
    canRetry: true,
    canContinue: false,
    isTerminal: true,
    isPending: false,
  },
  [KYC_STATUS.RESUBMISSION_REQUIRED]: {
    label: "Resubmission Required",
    description:
      "Additional information is needed to complete your verification. Please start a new session.",
    badgeVariant: "warning",
    canStartVerification: false,
    canRetry: true,
    canContinue: false,
    isTerminal: true,
    isPending: false,
  },
  [KYC_STATUS.ERROR]: {
    label: "Error",
    description: "Something went wrong during the verification process. Please try again.",
    badgeVariant: "destructive",
    canStartVerification: false,
    canRetry: true,
    canContinue: false,
    isTerminal: true,
    isPending: false,
  },
};

export function getKycStatusMeta(status: KycStatus): KycStatusMeta {
  return STATUS_META[status] ?? STATUS_META[KYC_STATUS.NOT_STARTED];
}

/**
 * Statuses that represent an active/reusable session
 * (user can continue without creating a new one)
 */
export const ACTIVE_SESSION_STATUSES: readonly KycStatus[] = [
  KYC_STATUS.INITIATED,
  KYC_STATUS.IN_PROGRESS,
] as const;

/**
 * Statuses that allow the user to start a fresh session
 */
export const RETRYABLE_STATUSES: readonly KycStatus[] = [
  KYC_STATUS.NOT_STARTED,
  KYC_STATUS.DECLINED,
  KYC_STATUS.EXPIRED,
  KYC_STATUS.RESUBMISSION_REQUIRED,
  KYC_STATUS.ERROR,
] as const;
