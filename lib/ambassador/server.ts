/**
 * Creator Ambassador Program — Server-side helpers
 *
 * Server-only. All writes use the admin (service-role) client so they
 * bypass RLS, which is correct: clients have no write policies on these tables.
 *
 * Referral code format: 8 URL-safe chars from a custom base32 alphabet
 * (no 0/O/1/I to avoid visual ambiguity).
 */

import "server-only";

import { randomBytes, createHash } from "crypto";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { logger } from "@/lib/logger";
import type {
  CreatorReferralProfile,
  AmbassadorProfileResponse,
  AmbassadorReferralsResponse,
  AmbassadorReferralSafe,
} from "./types";

// ─── Constants ────────────────────────────────────────────

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // base32, no 0/O/1/I
const CODE_LENGTH = 8;
const CODE_MAX_RETRIES = 5;

// ─── Referral code generation ─────────────────────────────

/**
 * Generate an opaque, URL-safe, non-enumerable referral code slug.
 * Retries on unique-constraint violation up to CODE_MAX_RETRIES times.
 */
function generateReferralCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  return Array.from(bytes)
    .map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length])
    .join("");
}

// ─── Enroll / get ambassador profile ─────────────────────

/**
 * Enroll a verified creator as an ambassador (idempotent).
 * Returns the existing or newly created CreatorReferralProfile row.
 *
 * Must be called server-side after requireVerifiedCreator().
 */
export async function enrollAmbassador(userId: string): Promise<CreatorReferralProfile> {
  const supabase = getSupabaseAdminClient();

  // Check if already enrolled (idempotent)
  const { data: existing } = await supabase
    .from("creator_referral_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    return existing as CreatorReferralProfile;
  }

  // Check program is enabled
  const { data: settings } = await supabase
    .from("creator_referral_settings")
    .select("program_enabled")
    .eq("id", 1)
    .single();

  if (!settings?.program_enabled) {
    throw new Error("PROGRAM_DISABLED");
  }

  // Generate unique code with retry
  let attempt = 0;
  while (attempt < CODE_MAX_RETRIES) {
    const code = generateReferralCode();

    const { data: row, error } = await supabase
      .from("creator_referral_profiles")
      .insert({ user_id: userId, referral_code: code, status: "active" })
      .select("*")
      .single();

    if (!error && row) {
      logger.info("[ambassador] Enrolled new ambassador", { userId, code });
      return row as CreatorReferralProfile;
    }

    // Unique constraint violation on referral_code → retry
    if (error?.code === "23505") {
      attempt++;
      continue;
    }

    logger.error("[ambassador] enrollAmbassador insert error", error, { userId });
    throw new Error("Failed to create ambassador profile");
  }

  throw new Error("Failed to generate unique referral code after retries");
}

/**
 * Get the ambassador profile row for a user, or null if not enrolled.
 */
export async function getAmbassadorProfile(userId: string): Promise<CreatorReferralProfile | null> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("creator_referral_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    logger.error("[ambassador] getAmbassadorProfile error", error, { userId });
    return null;
  }

  return (data as CreatorReferralProfile | null) ?? null;
}

// ─── Stats ────────────────────────────────────────────────

interface AmbassadorStats {
  clicks: number;
  signups: number;
  qualified: number;
  pending_estimated_cents: number;
  approved_estimated_cents: number;
}

/**
 * Compute ambassador stats for the /api/referral/me endpoint.
 * Uses service role; never exposes basis_revenue_cents or referred earnings.
 */
export async function getAmbassadorStats(userId: string): Promise<AmbassadorStats> {
  const supabase = getSupabaseAdminClient();

  // Click count from events
  const { count: clicks } = await supabase
    .from("creator_referral_events")
    .select("id", { count: "exact", head: true })
    .eq("referral_code", await getReferralCodeForUser(userId))
    .eq("event_type", "clicked");

  // Attribution counts
  const { data: attrRows } = await supabase
    .from("creator_referral_attributions")
    .select("status")
    .eq("referrer_user_id", userId)
    .eq("is_fraud", false)
    .not("status", "in", '("rejected","fraud")');

  const signups = attrRows?.length ?? 0;
  const qualified =
    attrRows?.filter((r) => ["qualified", "revenue_eligible"].includes(r.status)).length ?? 0;

  // Commission totals (estimated only — never basis_revenue_cents)
  const { data: commRows } = await supabase
    .from("creator_referral_commissions")
    .select("estimated_commission_amount_cents, approved_commission_amount_cents, status")
    .eq("referrer_user_id", userId)
    .not("status", "in", '("rejected")');

  const pending_estimated_cents =
    commRows
      ?.filter((r) => r.status === "pending")
      .reduce((s, r) => s + (r.estimated_commission_amount_cents ?? 0), 0) ?? 0;

  const approved_estimated_cents =
    commRows
      ?.filter((r) => r.status === "approved")
      .reduce(
        (s, r) =>
          s + (r.approved_commission_amount_cents ?? r.estimated_commission_amount_cents ?? 0),
        0
      ) ?? 0;

  return {
    clicks: clicks ?? 0,
    signups,
    qualified,
    pending_estimated_cents,
    approved_estimated_cents,
  };
}

/** Helper: look up referral_code for a user (used in stats) */
async function getReferralCodeForUser(userId: string): Promise<string> {
  const supabase = getSupabaseAdminClient();
  const { data } = await supabase
    .from("creator_referral_profiles")
    .select("referral_code")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.referral_code ?? "";
}

// ─── Full ambassador /me response ─────────────────────────

/**
 * Build the full AmbassadorProfileResponse for GET /api/referral/me.
 * Returns null if not enrolled.
 */
export async function getAmbassadorMeResponse(
  userId: string,
  host: string
): Promise<AmbassadorProfileResponse | null> {
  const profile = await getAmbassadorProfile(userId);
  if (!profile) return null;

  const stats = await getAmbassadorStats(userId);
  const protocol = host.startsWith("localhost") ? "http" : "https";

  return {
    code: profile.referral_code,
    link: `${protocol}://${host}/r/${profile.referral_code}`,
    status: profile.status,
    stats,
  };
}

// ─── Invited creators list ────────────────────────────────

/**
 * Paginated list of invited creators for the ambassador dashboard.
 * Privacy-safe: served from ambassador_referrals_safe view.
 * Never exposes earnings, email, KYC, buyers, or risk_flags.
 */
export async function getAmbassadorReferrals(
  referrerUserId: string,
  page: number = 1,
  pageSize: number = 20
): Promise<AmbassadorReferralsResponse> {
  const supabase = getSupabaseAdminClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, count, error } = await supabase
    .from("ambassador_referrals_safe")
    .select("id, referrer_user_id, status, qualified_at, created_at, display_name, avatar_url", {
      count: "exact",
    })
    .eq("referrer_user_id", referrerUserId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    logger.error("[ambassador] getAmbassadorReferrals error", error, { referrerUserId });
    return { items: [], total: 0, page, page_size: pageSize };
  }

  return {
    items: (data ?? []) as AmbassadorReferralSafe[],
    total: count ?? 0,
    page,
    page_size: pageSize,
  };
}

// ─── Referral code validation ─────────────────────────────

/**
 * Validate an active referral code AND fetch the ambassador's public display_name.
 *
 * Uses 2 sequential queries rather than a PostgREST join because
 * creator_referral_profiles.user_id references auth.users(id) — there is no
 * direct FK to public.profiles — so automatic join resolution would fail.
 * This is still faster than the previous 3-query path (validate → validate again
 * → display_name) which needlessly re-queried creator_referral_profiles.
 *
 * Returns { userId, displayName } if the code is active, null otherwise.
 * Never exposes user_id or email in the displayName.
 */
export async function validateAndGetDisplayName(code: string): Promise<{
  userId: string;
  displayName: string | null;
} | null> {
  if (!code || code.length !== CODE_LENGTH) return null;

  const supabase = getSupabaseAdminClient();

  // Query 1: validate code and get user_id (indexed on referral_code)
  const { data: prof } = await supabase
    .from("creator_referral_profiles")
    .select("user_id")
    .eq("referral_code", code)
    .eq("status", "active")
    .maybeSingle();

  if (!prof) return null;

  // Query 2: fetch public display_name from profiles
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", prof.user_id as string)
    .maybeSingle();

  return {
    userId: prof.user_id as string,
    displayName: (profile?.display_name as string | null) ?? null,
  };
}

/**
 * Validate that a referral code belongs to an active ambassador.
 * Returns the referrer user_id, or null if invalid/suspended.
 */
export async function validateReferralCode(code: string): Promise<string | null> {
  if (!code || code.length !== CODE_LENGTH) return null;

  const supabase = getSupabaseAdminClient();
  const { data } = await supabase
    .from("creator_referral_profiles")
    .select("user_id, status")
    .eq("referral_code", code)
    .maybeSingle();

  if (!data || data.status !== "active") return null;
  return data.user_id as string;
}

// ─── Display name for referral landing banner ─────────────

/**
 * Get the public display_name for a referral code.
 * Used by /r/[code] to pass ref_name to the auth page banner.
 * Returns null if code is invalid, suspended, or display_name is empty.
 * Never exposes user_id or email.
 */
export async function getReferralCodeDisplayName(code: string): Promise<string | null> {
  if (!code || code.length !== CODE_LENGTH) return null;

  // creator_referral_profiles has no display_name column — look it up via profiles.
  // Two queries is fine here: this only runs on /r/[code] redirect, not on hot paths.
  const supabase = getSupabaseAdminClient();
  const { data: prof } = await supabase
    .from("creator_referral_profiles")
    .select("user_id, status")
    .eq("referral_code", code)
    .maybeSingle();

  if (!prof || prof.status !== "active") return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", prof.user_id as string)
    .maybeSingle();

  return (profile?.display_name as string | null) || null;
}

// ─── Record a click event ─────────────────────────────────

/**
 * Record a 'clicked' event for a referral code visit.
 * Best-effort: never throws. IP is hashed for privacy.
 */
export async function recordReferralClick(code: string, ipHash: string | null): Promise<void> {
  try {
    const supabase = getSupabaseAdminClient();
    await supabase.from("creator_referral_events").insert({
      attribution_id: null,
      referral_code: code,
      event_type: "clicked",
      actor_user_id: null,
      metadata: ipHash ? { ip_hash: ipHash } : {},
    });
  } catch (err) {
    logger.warn("[ambassador] recordReferralClick failed (non-fatal)", { code, err });
  }
}

// ─── Helpers ──────────────────────────────────────────────

/** Simple one-way hash for IP addresses (privacy) */
export function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  return createHash("sha256")
    .update(ip + (process.env.SUPABASE_JWT_SECRET ?? "aref-ip-salt"))
    .digest("hex")
    .slice(0, 16);
}
