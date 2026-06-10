/**
 * TypeScript types for the Creator Ambassador Program (migration 042).
 *
 * These mirror the database schema exactly.  All monetary amounts are
 * in cents (bigint in DB, number in TS because JS does not have bigint
 * in JSON; values are always integers and fit within Number.MAX_SAFE_INTEGER
 * for realistic commission amounts).
 *
 * IMPORTANT (money-safety):
 *   - estimated_commission_amount_cents  ← used in MVP (accrued estimate)
 *   - approved_commission_amount_cents   ← used in MVP (admin-approved credit)
 *   - payable_commission_amount_cents    ← RESERVED / null in MVP; requires
 *                                          future payout system
 *   These amounts are INTERNAL RECORDS only.  They do NOT touch
 *   wallet_accounts balances and are NOT withdrawable in MVP.
 */

// ─── Enums / union types ─────────────────────────────────────────────────────

export type AmbassadorStatus = "active" | "suspended";

/** Coarse status stored on creator_referral_attributions.status */
export type AttributionStatus =
  | "signup_completed"
  | "creator_role_selected"
  | "kyc_verified"
  | "qualified"
  | "revenue_eligible"
  | "rejected"
  | "fraud";

/** Fine-grained funnel sub-states tracked in events only (NOT in attributions.status) */
export type ReferralEventType =
  | "clicked"
  | "signup_started"
  | "signup_completed"
  | "creator_role_selected"
  | "kyc_verified"
  | "profile_ready"
  | "first_paid_content_created"
  | "first_eligible_revenue"
  | "qualified"
  | "revenue_eligible"
  | "commission_accrued"
  | "commission_approved"
  | "commission_rejected"
  | "commission_voided"
  | "fraud_flag"
  | "admin_override"
  | "attribution_rejected";

/**
 * clawback_pending: approved commission flagged for potential recovery because an
 * underlying transaction was refunded/charged-back AFTER admin approval.
 * Admin must manually confirm recovery (→ rejected) or clear the flag (→ approved).
 * DB trigger for automated detection is a future improvement; the status is defined
 * here so UI and API handlers are prepared.
 */
export type CommissionStatus = "pending" | "approved" | "rejected" | "paid" | "clawback_pending";

/** Source of an attribution row */
export type AttributionSource =
  | "ambassador_program"
  | "legacy_profiles_referrer_id"
  | "admin_override";

/** Structured reason code for admin review decisions */
export type ReviewStatusReason =
  | "refund"
  | "chargeback"
  | "duplicate_account"
  | "policy_violation"
  | "account_suspended"
  | "dmca"
  | "payout_disputed"
  | "risk_flag"
  | "other";

export type AdminActionSource = "admin_ui" | "cron_recompute" | "script";

/** Advisory risk flags on attributions */
export type RiskFlag = "email_duplicate" | "ip_duplicate" | "device_duplicate" | "kyc_duplicate";

// ─── Table row types ─────────────────────────────────────────────────────────

export interface CreatorReferralSettings {
  id: 1;
  program_enabled: boolean;
  commission_percent: number; // numeric(5,2) → number in TS
  duration_months: number;
  commission_cap_cents: number | null;
  approval_delay_days: number;
  require_admin_approval: boolean;
  mirror_to_ledger: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreatorReferralProfile {
  id: string;
  user_id: string;
  referral_code: string;
  status: AmbassadorStatus;
  created_at: string;
  updated_at: string;
}

export interface CreatorReferralAttribution {
  id: string;
  referrer_user_id: string;
  referred_user_id: string;
  referral_code: string;
  source: AttributionSource;
  status: AttributionStatus;
  qualified_at: string | null;
  window_ends_at: string | null;
  risk_flags: RiskFlag[];
  is_fraud: boolean;
  signup_ip: string | null;
  bound_by_admin: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatorReferralEvent {
  id: string;
  attribution_id: string | null;
  referral_code: string | null;
  event_type: ReferralEventType | string; // string fallback for future types
  actor_user_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface CreatorReferralCommission {
  id: string;
  attribution_id: string;
  referrer_user_id: string;
  referred_user_id: string;
  period_start: string;
  period_end: string;
  /** Admin-only field. Must NEVER be returned to referrer-facing APIs. */
  basis_revenue_cents: number;
  commission_percent: number;
  estimated_commission_amount_cents: number;
  approved_commission_amount_cents: number | null;
  /** RESERVED – always null in MVP. */
  payable_commission_amount_cents: number | null;
  status: CommissionStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  status_reason: ReviewStatusReason | null;
  admin_action_source: AdminActionSource | null;
  ledger_transaction_id: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Safe view row type (referrer-facing) ────────────────────────────────────

/** Row from ambassador_referrals_safe view. No earnings/email/KYC/risk data. */
export interface AmbassadorReferralSafe {
  id: string;
  referrer_user_id: string;
  status: AttributionStatus;
  qualified_at: string | null;
  created_at: string;
  display_name: string; // COALESCE to 'Pending creator' for non-creators
  avatar_url: string | null;
}

// ─── Insert / update helpers ─────────────────────────────────────────────────

export type CreatorReferralProfileInsert = Omit<
  CreatorReferralProfile,
  "id" | "created_at" | "updated_at"
>;

export type CreatorReferralAttributionInsert = Omit<
  CreatorReferralAttribution,
  "id" | "created_at" | "updated_at"
>;

export type CreatorReferralEventInsert = Omit<CreatorReferralEvent, "id" | "created_at">;

export type CreatorReferralCommissionInsert = Omit<
  CreatorReferralCommission,
  | "id"
  | "approved_commission_amount_cents"
  | "payable_commission_amount_cents"
  | "reviewed_by"
  | "reviewed_at"
  | "review_note"
  | "status_reason"
  | "admin_action_source"
  | "ledger_transaction_id"
  | "created_at"
  | "updated_at"
>;

// ─── API response shapes ─────────────────────────────────────────────────────

/** Returned by GET /api/referral/me */
export interface AmbassadorProfileResponse {
  code: string;
  link: string;
  status: AmbassadorStatus;
  stats: {
    clicks: number;
    signups: number;
    qualified: number;
    pending_estimated_cents: number;
    approved_estimated_cents: number;
  };
}

/** Returned by GET /api/referral/me/referrals */
export interface AmbassadorReferralsResponse {
  items: AmbassadorReferralSafe[];
  total: number;
  page: number;
  page_size: number;
}

/** Admin commission row (includes basis_revenue_cents; never sent to referrer) */
export type AdminCommissionRow = CreatorReferralCommission;

/** Referrer-facing commission row (basis_revenue_cents omitted) */
export type ReferrerCommissionRow = Omit<
  CreatorReferralCommission,
  "basis_revenue_cents" | "referred_user_id" | "payable_commission_amount_cents"
>;
