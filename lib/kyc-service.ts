/**
 * KYC Service - Legacy re-export
 *
 * @deprecated Import from "@/lib/kyc/kyc-service" instead.
 * This file is kept for backward compatibility with existing imports
 * (e.g. webhook route, posts module).
 */

export type { KycStatus } from "./kyc/kyc-status";

export type KYCStatus = "not_started" | "pending" | "approved" | "failed";

export interface KYCResult {
  status: KYCStatus;
  verified: boolean;
  message?: string;
}

export { getKycStatus as checkKYCStatus } from "./kyc/kyc-service";

/**
 * @deprecated Use processWebhookEvent from lib/kyc/kyc-service instead.
 */
export async function updateKYCStatus(userId: string, status: KYCStatus): Promise<boolean> {
  // Minimal backward-compat shim: import dynamically to avoid circular deps
  const { getSupabaseAdminClient } = await import("@/lib/supabase-admin");
  try {
    const supabase = getSupabaseAdminClient();
    const ageVerified = status === "approved";
    const { error } = await supabase
      .from("profiles")
      .update({ age_verified: ageVerified })
      .eq("id", userId);
    if (error) {
      console.error("[kyc-service] updateKYCStatus error:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[kyc-service] updateKYCStatus exception:", err);
    return false;
  }
}

/**
 * @deprecated Use getKycStatus from lib/kyc/kyc-service instead.
 */
export async function isKYCVerified(): Promise<boolean> {
  return false;
}
