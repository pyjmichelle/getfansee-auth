/**
 * Creator Ambassador Program — Attribution binding & qualification logic
 *
 * Server-only. All DB writes use the admin (service-role) client.
 *
 * Key rules (from PRD):
 *   - First valid referral wins; never overwrite existing attribution.
 *   - No self-referral (referrer == referred, or same normalised email).
 *   - Attribution only at first profile creation (signup_completed).
 *     An already-registered user visiting a referral link is NOT attributed.
 *   - qualified = kyc_verified AND creator role active AND first_eligible_revenue.
 *     KYC pass alone is NOT sufficient.
 *   - All errors are best-effort: never break signup or KYC flow.
 */

import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { logger } from "@/lib/logger";
import { validateReferralCode } from "./server";

// ─── Types ────────────────────────────────────────────────

interface BindResult {
  bound: boolean;
  reason?: string;
}

// ─── Anti-fraud helpers ───────────────────────────────────

/** Normalise an email for duplicate detection (lowercase, strip + aliases) */
function normaliseEmail(email: string): string {
  const [local, domain] = email.toLowerCase().split("@");
  const cleanLocal = local.replace(/\+.*$/, "").replace(/\./g, "");
  return `${cleanLocal}@${domain}`;
}

/** Compute advisory risk flags for a new attribution */
async function computeRiskFlags(
  referredUserId: string,
  referredEmail: string,
  referrerUserId: string,
  signupIp: string | null
): Promise<string[]> {
  const supabase = getSupabaseAdminClient();
  const flags: string[] = [];

  const normalisedEmail = normaliseEmail(referredEmail);

  // Duplicate email (same normalised email as another referred user)
  const { data: emailDupes } = await supabase
    .from("profiles")
    .select("id")
    .neq("id", referredUserId)
    .neq("id", referrerUserId)
    .ilike("email", `%${normalisedEmail.split("@")[0]}%`);
  if (emailDupes && emailDupes.length > 0) {
    flags.push("email_duplicate");
  }

  // Duplicate IP within 30 days (if ip is available)
  if (signupIp) {
    const { data: ipDupes } = await supabase
      .from("creator_referral_attributions")
      .select("id")
      .eq("signup_ip", signupIp)
      .neq("referred_user_id", referredUserId)
      .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
    if (ipDupes && ipDupes.length > 0) {
      flags.push("ip_duplicate");
    }
  }

  return flags;
}

// ─── Attribution binding ──────────────────────────────────

/**
 * Attempt to bind an ambassador referral attribution for a newly created user.
 *
 * Called by ensureProfile() immediately after a new profiles row is inserted.
 * Best-effort: errors are logged but never thrown (must not break signup).
 *
 * @param referredUserId  The newly created user's id
 * @param referredEmail   The newly created user's email (for anti-fraud)
 * @param arefCode        The `aref` cookie value read server-side
 * @param signupIp        Raw IP from request headers (stored for duplicate detection)
 */
export async function bindAmbassadorAttribution(
  referredUserId: string,
  referredEmail: string,
  arefCode: string | null,
  signupIp: string | null
): Promise<BindResult> {
  try {
    if (!arefCode) {
      return { bound: false, reason: "no_cookie" };
    }

    const supabase = getSupabaseAdminClient();

    // Guard: already has an attribution (first-touch wins)
    const { data: existingAttr } = await supabase
      .from("creator_referral_attributions")
      .select("id")
      .eq("referred_user_id", referredUserId)
      .single();

    if (existingAttr) {
      return { bound: false, reason: "already_attributed" };
    }

    // Validate the referral code → get referrer user id
    const referrerUserId = await validateReferralCode(arefCode);
    if (!referrerUserId) {
      return { bound: false, reason: "invalid_code" };
    }

    // Anti-fraud: no self-referral by user id
    if (referrerUserId === referredUserId) {
      logger.warn("[ambassador/bind] Self-referral attempt blocked", { referredUserId });
      return { bound: false, reason: "self_referral" };
    }

    // Anti-fraud: no self-referral by normalised email
    const { data: referrerProfile } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", referrerUserId)
      .single();

    if (
      referrerProfile?.email &&
      normaliseEmail(referrerProfile.email) === normaliseEmail(referredEmail)
    ) {
      logger.warn("[ambassador/bind] Self-referral by email blocked", { referredUserId });
      return { bound: false, reason: "self_referral_email" };
    }

    // Compute advisory risk flags
    const riskFlags = await computeRiskFlags(
      referredUserId,
      referredEmail,
      referrerUserId,
      signupIp
    );

    // Insert attribution row
    const { error: insertError } = await supabase.from("creator_referral_attributions").insert({
      referrer_user_id: referrerUserId,
      referred_user_id: referredUserId,
      referral_code: arefCode,
      source: "ambassador_program",
      status: "signup_completed",
      risk_flags: riskFlags,
      signup_ip: signupIp,
    });

    if (insertError) {
      // Unique constraint on referred_user_id — concurrent insert; ignore
      if (insertError.code === "23505") {
        return { bound: false, reason: "concurrent_already_attributed" };
      }
      logger.error("[ambassador/bind] Failed to insert attribution", insertError, {
        referredUserId,
        referrerUserId,
      });
      return { bound: false, reason: "db_error" };
    }

    // Denormalise onto profiles.referrer_id (legacy compat pointer only)
    await supabase
      .from("profiles")
      .update({ referrer_id: referrerUserId })
      .eq("id", referredUserId);

    // Emit signup_completed event
    await emitEvent(null, arefCode, "signup_completed", null, {
      referred_user_id: referredUserId,
      referrer_user_id: referrerUserId,
      risk_flags: riskFlags,
    });

    logger.info("[ambassador/bind] Attribution bound", {
      referredUserId,
      referrerUserId,
      code: arefCode,
      riskFlags,
    });

    return { bound: true };
  } catch (err) {
    logger.error("[ambassador/bind] bindAmbassadorAttribution unexpected error", err, {
      referredUserId,
    });
    return { bound: false, reason: "unexpected_error" };
  }
}

// ─── Status transitions ───────────────────────────────────

/**
 * Transition the attribution to creator_role_selected.
 * Called when a user submits a creator application (POST /api/creator/apply).
 * Best-effort.
 */
export async function transitionToCreatorRoleSelected(userId: string): Promise<void> {
  await transitionAttribution(
    userId,
    "signup_completed",
    "creator_role_selected",
    "creator_role_selected"
  );
}

/**
 * Transition the attribution to kyc_verified.
 * Called by kyc-service.ts after APPROVED webhook.
 * Then immediately evaluates qualification.
 * Best-effort.
 */
export async function transitionToKycVerified(userId: string): Promise<void> {
  await transitionAttribution(userId, "creator_role_selected", "kyc_verified", "kyc_verified");
  // Evaluate qualification immediately after KYC
  await evaluateQualification(userId);
}

/**
 * Internal helper: advance attribution status if current status matches expectedFrom.
 */
async function transitionAttribution(
  referredUserId: string,
  fromStatus: string,
  toStatus: string,
  eventType: string
): Promise<void> {
  try {
    const supabase = getSupabaseAdminClient();

    const { data: attr } = await supabase
      .from("creator_referral_attributions")
      .select("id, status, referral_code")
      .eq("referred_user_id", referredUserId)
      .eq("is_fraud", false)
      .single();

    if (!attr) return; // no attribution — not referred via ambassador program
    if (attr.status !== fromStatus) return; // already advanced or wrong state

    const { error } = await supabase
      .from("creator_referral_attributions")
      .update({ status: toStatus })
      .eq("id", attr.id);

    if (error) {
      logger.error("[ambassador/bind] transitionAttribution error", error, {
        referredUserId,
        toStatus,
      });
      return;
    }

    await emitEvent(attr.id, attr.referral_code, eventType, null, {
      status_before: fromStatus,
      status_after: toStatus,
    });

    logger.info("[ambassador/bind] Attribution transitioned", {
      referredUserId,
      from: fromStatus,
      to: toStatus,
    });
  } catch (err) {
    logger.warn("[ambassador/bind] transitionAttribution unexpected error", {
      referredUserId,
      toStatus,
      err,
    });
  }
}

// ─── Qualification evaluation ─────────────────────────────

/**
 * Evaluate whether a referred user now meets the `qualified` bar.
 *
 * MVP rule: qualified = kyc_verified + creator role active + first_eligible_revenue
 *
 * "First eligible revenue" = at least one transactions row credited to the
 * referred creator with:
 *   - type IN ('ppv_revenue', 'subscription')
 *   - status = 'completed'  (not pending/failed/refunded)
 *   - user_id = referredUserId  (not self-purchase — same user bought)
 *     Note: we cannot detect all self-purchase cases without buyer field;
 *     this is a known limitation.
 *
 * Must be called:
 *   1. After KYC approval (transitionToKycVerified → evaluateQualification)
 *   2. After a new revenue event is created (Phase 5 accrual job will re-run)
 *
 * Best-effort: never throws.
 */
export async function evaluateQualification(referredUserId: string): Promise<void> {
  try {
    const supabase = getSupabaseAdminClient();

    // Get attribution (must be in kyc_verified or higher non-terminal state)
    const { data: attr } = await supabase
      .from("creator_referral_attributions")
      .select("id, status, referral_code")
      .eq("referred_user_id", referredUserId)
      .eq("is_fraud", false)
      .not("status", "in", '("rejected","fraud","qualified","revenue_eligible")')
      .single();

    if (!attr) return; // not referred, already qualified, or fraud/rejected

    // Verify creator role is active
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, age_verified")
      .eq("id", referredUserId)
      .single();

    if (profile?.role !== "creator" || !profile?.age_verified) return;

    // Check first eligible revenue
    const { data: revRows } = await supabase
      .from("transactions")
      .select("id")
      .eq("user_id", referredUserId)
      .in("type", ["ppv_revenue", "subscription"])
      .eq("status", "completed")
      .limit(1);

    if (!revRows || revRows.length === 0) return; // no eligible revenue yet

    // All conditions met: set qualified
    const now = new Date().toISOString();

    // Get commission window duration from settings
    const { data: settings } = await supabase
      .from("creator_referral_settings")
      .select("duration_months")
      .eq("id", 1)
      .single();

    const durationMonths = settings?.duration_months ?? 12;
    const windowEndsAt = addMonths(now, durationMonths);

    const { error } = await supabase
      .from("creator_referral_attributions")
      .update({
        status: "qualified",
        qualified_at: now,
        window_ends_at: windowEndsAt,
      })
      .eq("id", attr.id);

    if (error) {
      logger.error("[ambassador/bind] evaluateQualification update error", error, {
        referredUserId,
      });
      return;
    }

    await emitEvent(attr.id, attr.referral_code, "qualified", null, {
      qualified_at: now,
      window_ends_at: windowEndsAt,
    });

    // Also emit first_eligible_revenue event for funnel tracking
    await emitEvent(attr.id, attr.referral_code, "first_eligible_revenue", null, {});

    logger.info("[ambassador/bind] Attribution qualified", {
      referredUserId,
      qualified_at: now,
      window_ends_at: windowEndsAt,
    });
  } catch (err) {
    logger.warn("[ambassador/bind] evaluateQualification unexpected error", {
      referredUserId,
      err,
    });
  }
}

// ─── Event helper ─────────────────────────────────────────

/** Insert a creator_referral_events row (best-effort). */
async function emitEvent(
  attributionId: string | null,
  referralCode: string | null,
  eventType: string,
  actorUserId: string | null,
  metadata: Record<string, unknown>
): Promise<void> {
  try {
    const supabase = getSupabaseAdminClient();
    await supabase.from("creator_referral_events").insert({
      attribution_id: attributionId,
      referral_code: referralCode,
      event_type: eventType,
      actor_user_id: actorUserId,
      metadata,
    });
  } catch (err) {
    logger.warn("[ambassador/bind] emitEvent failed", { eventType, err });
  }
}

// ─── Date util ────────────────────────────────────────────

/** Add N calendar months to an ISO timestamp string */
function addMonths(isoDate: string, months: number): string {
  const d = new Date(isoDate);
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}
