/**
 * KYC Business Logic Service
 *
 * Server-side only. Orchestrates Didit session lifecycle,
 * state transitions, and database persistence.
 */

import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { logger } from "@/lib/logger";
import { createDiditSession, type CreateSessionParams } from "./didit-client";
import { mapDiditStatus, shouldTransition, type DiditWebhookPayload } from "./didit-mapper";
import {
  KYC_STATUS,
  ACTIVE_SESSION_STATUSES,
  RETRYABLE_STATUSES,
  type KycStatus,
  getKycStatusMeta,
} from "./kyc-status";

// ─── Types ───────────────────────────────────────────────

export interface KycStatusResponse {
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

export interface CreateSessionResult {
  sessionId: string;
  verificationUrl: string;
  sessionToken: string;
  isExisting: boolean;
}

// ─── Read Operations ─────────────────────────────────────

/**
 * Get the current KYC status for a user, ready for API/UI consumption.
 */
export async function getKycStatus(userId: string): Promise<KycStatusResponse> {
  const supabase = getSupabaseAdminClient();

  const { data: verification } = await supabase
    .from("creator_verifications")
    .select("status, kyc_session_id, kyc_verification_url, kyc_decided_at")
    .eq("user_id", userId)
    .single();

  const status = (verification?.status as KycStatus) ?? KYC_STATUS.NOT_STARTED;
  const meta = getKycStatusMeta(status);

  // If session is active, fetch the latest session URL
  let verificationUrl = verification?.kyc_verification_url ?? null;
  if (
    ACTIVE_SESSION_STATUSES.includes(status) &&
    verification?.kyc_session_id &&
    !verificationUrl
  ) {
    const { data: session } = await supabase
      .from("kyc_sessions")
      .select("verification_url")
      .eq("external_session_id", verification.kyc_session_id)
      .single();
    verificationUrl = session?.verification_url ?? null;
  }

  return {
    status,
    displayStatus: meta.label,
    message: meta.description,
    canRetry: meta.canRetry,
    canContinue: meta.canContinue,
    canStart: meta.canStartVerification,
    sessionId: verification?.kyc_session_id ?? null,
    verificationUrl,
    decidedAt: verification?.kyc_decided_at ?? null,
  };
}

// ─── Session Creation ────────────────────────────────────

/**
 * Create or resume a Didit verification session for a user.
 *
 * - If an active session exists, returns it instead of creating a new one.
 * - If the user's status doesn't allow a new session, throws.
 */
export async function createOrResumeSession(
  userId: string,
  callbackUrl: string,
  userEmail?: string
): Promise<CreateSessionResult> {
  const supabase = getSupabaseAdminClient();

  // 1. Check current verification record
  const { data: verification } = await supabase
    .from("creator_verifications")
    .select("status, kyc_session_id")
    .eq("user_id", userId)
    .single();

  const currentStatus = (verification?.status as KycStatus) ?? KYC_STATUS.NOT_STARTED;

  // 2. If there's an active session, return it
  if (ACTIVE_SESSION_STATUSES.includes(currentStatus) && verification?.kyc_session_id) {
    const { data: existingSession } = await supabase
      .from("kyc_sessions")
      .select("external_session_id, verification_url, session_token")
      .eq("external_session_id", verification.kyc_session_id)
      .single();

    if (existingSession?.verification_url) {
      return {
        sessionId: existingSession.external_session_id,
        verificationUrl: existingSession.verification_url,
        sessionToken: existingSession.session_token ?? "",
        isExisting: true,
      };
    }
  }

  // 3. Check if user is allowed to create a new session
  if (currentStatus !== KYC_STATUS.NOT_STARTED && !RETRYABLE_STATUSES.includes(currentStatus)) {
    if (currentStatus === KYC_STATUS.APPROVED) {
      throw new Error("KYC already approved");
    }
    if (currentStatus === KYC_STATUS.SUBMITTED) {
      throw new Error("KYC is currently under review");
    }
    throw new Error(`Cannot start new KYC session in status: ${currentStatus}`);
  }

  // 4. Call Didit API to create session
  const params: CreateSessionParams = {
    vendorData: userId,
    callbackUrl,
    metadata: { source: "getfansee-creator-kyc" },
  };
  if (userEmail) {
    params.contactDetails = { email: userEmail };
  }

  const diditResponse = await createDiditSession(params);

  // 5. Record session in kyc_sessions
  const { error: sessionError } = await supabase.from("kyc_sessions").insert({
    user_id: userId,
    external_session_id: diditResponse.session_id,
    workflow_id: diditResponse.workflow_id,
    verification_url: diditResponse.verification_url,
    session_token: diditResponse.session_token,
    status: KYC_STATUS.INITIATED,
    vendor_data: userId,
  });

  if (sessionError) {
    logger.error("[kyc-service] Failed to record kyc_session", sessionError, { userId });
  }

  // 6. Upsert creator_verifications record
  // real_name / birth_date / country are nullable after migration 041;
  // Didit will provide identity data via webhook — no placeholders needed.
  const verificationData = {
    user_id: userId,
    status: KYC_STATUS.INITIATED,
    kyc_provider: "didit",
    kyc_session_id: diditResponse.session_id,
    kyc_verification_url: diditResponse.verification_url,
    kyc_external_status: diditResponse.status,
    kyc_started_at: new Date().toISOString(),
    kyc_last_error: null,
  };

  const { error: upsertError } = await supabase
    .from("creator_verifications")
    .upsert(verificationData, { onConflict: "user_id" });

  if (upsertError) {
    logger.error("[kyc-service] Failed to upsert creator_verifications", upsertError, { userId });
    throw new Error("Failed to initialize verification record");
  }

  // 7. Record event
  await recordKycEvent(userId, "session.created", diditResponse.session_id, {
    statusBefore: currentStatus,
    statusAfter: KYC_STATUS.INITIATED,
  });

  return {
    sessionId: diditResponse.session_id,
    verificationUrl: diditResponse.verification_url,
    sessionToken: diditResponse.session_token,
    isExisting: false,
  };
}

// ─── Webhook Processing ──────────────────────────────────

/**
 * Process a Didit webhook event. Handles idempotency, status mapping,
 * event recording, and database updates.
 *
 * Returns true if the event was processed (or already processed).
 */
export async function processWebhookEvent(
  payload: DiditWebhookPayload
): Promise<{ processed: boolean; isDuplicate: boolean }> {
  const supabase = getSupabaseAdminClient();
  const externalSessionId = payload.session_id;
  const eventId =
    payload.event_id ?? `${externalSessionId}-${payload.status}-${payload.timestamp ?? Date.now()}`;

  // 1. Idempotency check via webhook_events
  const { error: dedupeError } = await supabase.from("webhook_events").insert({
    provider: "didit",
    event_id: eventId,
    payload_hash: simpleHash(JSON.stringify(payload)),
    status: "processed",
  });

  if (dedupeError?.code === "23505") {
    logger.info("[kyc-service] Duplicate webhook event", { eventId });
    return { processed: true, isDuplicate: true };
  }

  // 2. Look up session to find user
  const userId = payload.vendor_data ?? (await resolveUserFromSession(externalSessionId));
  if (!userId) {
    logger.warn("[kyc-service] Cannot resolve user for session", {
      sessionId: externalSessionId,
    });
    return { processed: false, isDuplicate: false };
  }

  // 3. Map external status
  const newInternalStatus = mapDiditStatus(payload.status);

  // 4. Get current status
  const { data: verification } = await supabase
    .from("creator_verifications")
    .select("status")
    .eq("user_id", userId)
    .single();

  const currentStatus = (verification?.status as KycStatus) ?? KYC_STATUS.NOT_STARTED;

  // 5. Check if transition is valid
  if (!shouldTransition(currentStatus, newInternalStatus)) {
    logger.info("[kyc-service] Skipping invalid status transition", {
      userId,
      currentStatus,
      newInternalStatus,
      externalStatus: payload.status,
    });
    await recordKycEvent(userId, payload.webhook_type, externalSessionId, {
      statusBefore: currentStatus,
      statusAfter: currentStatus,
      skipped: true,
      payload: payload,
    });
    return { processed: true, isDuplicate: false };
  }

  // 6. Build update payload
  const now = new Date().toISOString();
  const updateData: Record<string, unknown> = {
    status: newInternalStatus,
    kyc_external_status: payload.status,
    kyc_raw_payload: payload,
  };

  if (newInternalStatus === KYC_STATUS.APPROVED || newInternalStatus === KYC_STATUS.DECLINED) {
    updateData.kyc_decided_at = now;
  }
  if (newInternalStatus === KYC_STATUS.SUBMITTED) {
    updateData.kyc_submitted_at = now;
  }
  if (newInternalStatus === KYC_STATUS.APPROVED) {
    updateData.kyc_age_verified = true;
  }

  // 7. Update creator_verifications
  const { error: updateError } = await supabase
    .from("creator_verifications")
    .update(updateData)
    .eq("user_id", userId);

  if (updateError) {
    logger.error("[kyc-service] Failed to update creator_verifications", updateError, { userId });
  }

  // 8. Update kyc_sessions
  await supabase
    .from("kyc_sessions")
    .update({ status: newInternalStatus })
    .eq("external_session_id", externalSessionId);

  // 9. If approved: activate creator role + age_verified
  if (newInternalStatus === KYC_STATUS.APPROVED) {
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ age_verified: true, role: "creator" })
      .eq("id", userId);

    if (profileError) {
      logger.error("[kyc-service] Failed to activate creator profile", profileError, { userId });
    }

    // Ensure creators record exists so the user appears in creator listings
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("display_name, email")
      .eq("id", userId)
      .single();

    const fallbackName =
      existingProfile?.display_name ?? existingProfile?.email?.split("@")[0] ?? "creator";
    const { error: creatorsError } = await supabase
      .from("creators")
      .upsert({ id: userId, display_name: fallbackName }, { onConflict: "id" });

    if (creatorsError) {
      logger.error("[kyc-service] Failed to upsert creators record", creatorsError, { userId });
    }

    logger.info("[kyc-service] Creator activated via KYC approval", { userId });
  }

  // 10. Record audit event
  await recordKycEvent(userId, payload.webhook_type, externalSessionId, {
    statusBefore: currentStatus,
    statusAfter: newInternalStatus,
    payload,
  });

  logger.info("[kyc-service] Webhook processed", {
    userId,
    sessionId: externalSessionId,
    transition: `${currentStatus} -> ${newInternalStatus}`,
  });

  return { processed: true, isDuplicate: false };
}

// ─── Admin Operations ────────────────────────────────────

/**
 * Get KYC verifications for admin review, including Didit metadata.
 */
export async function getKycVerificationsForAdmin(statusFilter?: string) {
  const supabase = getSupabaseAdminClient();

  let query = supabase
    .from("creator_verifications")
    .select(
      "id, user_id, real_name, birth_date, country, id_doc_urls, status, " +
        "kyc_provider, kyc_session_id, kyc_external_status, kyc_started_at, " +
        "kyc_submitted_at, kyc_decided_at, kyc_age_verified, kyc_last_error, " +
        "reviewed_by, reviewed_at, rejection_reason, created_at, updated_at"
    )
    .order("created_at", { ascending: false });

  if (statusFilter) {
    query = query.eq("status", statusFilter);
  }

  const { data, error } = await query;
  if (error) {
    logger.error("[kyc-service] Failed to fetch admin verifications", error);
    throw error;
  }
  return data ?? [];
}

// ─── Helpers ─────────────────────────────────────────────

async function resolveUserFromSession(externalSessionId: string): Promise<string | null> {
  const supabase = getSupabaseAdminClient();
  const { data } = await supabase
    .from("kyc_sessions")
    .select("user_id")
    .eq("external_session_id", externalSessionId)
    .single();
  return data?.user_id ?? null;
}

async function recordKycEvent(
  userId: string,
  eventType: string,
  externalSessionId: string | null,
  details: Record<string, unknown>
) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("kyc_events").insert({
    user_id: userId,
    event_type: eventType,
    external_session_id: externalSessionId,
    internal_status_before: details.statusBefore as string | null,
    internal_status_after: details.statusAfter as string | null,
    payload_json: details.payload ?? null,
    error_message: details.error as string | null,
  });

  if (error) {
    logger.warn("[kyc-service] Failed to record kyc_event", { userId, error: error.message });
  }
}

function simpleHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return hash.toString(16);
}
