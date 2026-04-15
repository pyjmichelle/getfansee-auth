/**
 * Creator Eligibility Service
 *
 * Server-side only. Checks whether a user is eligible for creator
 * features based on their KYC status and profile role.
 */

import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { KYC_STATUS, type KycStatus } from "./kyc-status";

export interface CreatorEligibility {
  isCreator: boolean;
  isKycApproved: boolean;
  isAgeVerified: boolean;
  kycStatus: KycStatus;
  canAccessCreatorStudio: boolean;
  canPublishFreeContent: boolean;
  canPublishPaidContent: boolean;
  blockedReason: string | null;
}

/**
 * Evaluate a user's eligibility for creator features.
 *
 * Used by permission gates and API routes to make consistent decisions
 * about what a user can and cannot do.
 */
export async function getCreatorEligibility(userId: string): Promise<CreatorEligibility> {
  const supabase = getSupabaseAdminClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, age_verified")
    .eq("id", userId)
    .single();

  const isCreator = profile?.role === "creator";
  const isAgeVerified = !!profile?.age_verified;

  const { data: verification } = await supabase
    .from("creator_verifications")
    .select("status")
    .eq("user_id", userId)
    .single();

  const kycStatus = (verification?.status as KycStatus) ?? KYC_STATUS.NOT_STARTED;
  const isKycApproved = kycStatus === KYC_STATUS.APPROVED;

  let blockedReason: string | null = null;
  if (!isCreator) {
    blockedReason = "Creator account not activated";
  } else if (!isKycApproved) {
    blockedReason = "Identity verification required";
  }

  return {
    isCreator,
    isKycApproved,
    isAgeVerified,
    kycStatus,
    canAccessCreatorStudio: isCreator,
    canPublishFreeContent: isCreator,
    canPublishPaidContent: isCreator && isAgeVerified,
    blockedReason,
  };
}

/**
 * Quick check: is user's KYC approved?
 */
export async function isKycApproved(userId: string): Promise<boolean> {
  const supabase = getSupabaseAdminClient();
  const { data } = await supabase
    .from("creator_verifications")
    .select("status")
    .eq("user_id", userId)
    .single();
  return data?.status === KYC_STATUS.APPROVED;
}
