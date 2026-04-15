/**
 * Didit External Status -> GetFanSee Internal Status Mapper
 *
 * Didit v3 session statuses:
 *   Not Started | In Progress | In Review | Approved | Declined | Abandoned | Expired
 *
 * All mapping logic is centralized here; no raw Didit statuses
 * should leak into business logic or UI code.
 */

import { KYC_STATUS, type KycStatus } from "./kyc-status";

/**
 * Known Didit v3 session statuses (case-sensitive as returned by API)
 */
export type DiditSessionStatus =
  | "Not Started"
  | "In Progress"
  | "In Review"
  | "Approved"
  | "Declined"
  | "Abandoned"
  | "Expired";

const DIDIT_TO_INTERNAL: Record<DiditSessionStatus, KycStatus> = {
  "Not Started": KYC_STATUS.INITIATED,
  "In Progress": KYC_STATUS.IN_PROGRESS,
  "In Review": KYC_STATUS.SUBMITTED,
  Approved: KYC_STATUS.APPROVED,
  Declined: KYC_STATUS.DECLINED,
  Abandoned: KYC_STATUS.EXPIRED,
  Expired: KYC_STATUS.EXPIRED,
};

/**
 * Map a Didit external status string to our internal KYC status.
 * Returns KYC_STATUS.ERROR for unrecognized values.
 */
export function mapDiditStatus(externalStatus: string): KycStatus {
  return DIDIT_TO_INTERNAL[externalStatus as DiditSessionStatus] ?? KYC_STATUS.ERROR;
}

/**
 * Didit v3 webhook event types we handle
 */
export type DiditWebhookType =
  | "status.updated"
  | "data.updated"
  | "user.status.updated"
  | "user.data.updated";

/**
 * Shape of a Didit v3 webhook payload (fields we consume)
 */
export interface DiditWebhookPayload {
  session_id: string;
  status: string;
  webhook_type: string;
  vendor_data?: string;
  workflow_id?: string;
  metadata?: Record<string, unknown>;
  decision?: DiditDecision;
  event_id?: string;
  timestamp?: number;
  created_at?: number;
}

export interface DiditDecision {
  status: string;
  id_verifications?: unknown[];
  liveness_checks?: unknown[];
  face_matches?: unknown[];
  aml_screenings?: unknown[];
  [key: string]: unknown;
}

/**
 * Shape of a Didit v3 create-session response
 */
export interface DiditCreateSessionResponse {
  session_id: string;
  session_number?: number;
  session_token: string;
  verification_url: string;
  vendor_data?: string;
  metadata?: Record<string, unknown>;
  status: string;
  workflow_id: string;
  callback?: string;
}

/**
 * Determine if a status transition is valid/should be applied.
 * Prevents backwards transitions (e.g. approved -> in_progress from a stale webhook).
 */
const STATUS_PRIORITY: Record<KycStatus, number> = {
  [KYC_STATUS.NOT_STARTED]: 0,
  [KYC_STATUS.INITIATED]: 1,
  [KYC_STATUS.IN_PROGRESS]: 2,
  [KYC_STATUS.SUBMITTED]: 3,
  [KYC_STATUS.APPROVED]: 10,
  [KYC_STATUS.DECLINED]: 10,
  [KYC_STATUS.EXPIRED]: 5,
  [KYC_STATUS.RESUBMISSION_REQUIRED]: 5,
  [KYC_STATUS.ERROR]: 4,
};

export function shouldTransition(currentStatus: KycStatus, newStatus: KycStatus): boolean {
  if (currentStatus === newStatus) return false;
  // Terminal approved/declined can only be overridden by another terminal status
  if (currentStatus === KYC_STATUS.APPROVED) return false;
  return STATUS_PRIORITY[newStatus] >= STATUS_PRIORITY[currentStatus];
}
