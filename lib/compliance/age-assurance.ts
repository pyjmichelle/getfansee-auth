/**
 * Age assurance service — writes the evidence rows that back the signed cookie.
 *
 * Split from `assurance-token.ts` on purpose: that module must stay Edge-safe
 * because middleware imports it, whereas this one talks to the database with
 * the service role and is therefore Node-only.
 */

import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { env } from "@/lib/env";
import { createDiditSession, getDiditSessionDecision } from "@/lib/kyc/didit-client";
import { AGE_ASSURANCE_TTL_HOURS } from "./jurisdictions";
import type { AccessTier, GeoContext } from "./jurisdictions";
import {
  AGE_ASSURANCE_COOKIE,
  getAssuranceSecret,
  signAssuranceToken,
  type AssuranceMethod,
} from "./assurance-token";

/** Tier B/C methods that go out to a vendor, as opposed to a checkbox. */
export type VendorAssuranceMethod = Extract<AssuranceMethod, "age_estimation" | "document">;

/**
 * Prefix on Didit's `vendor_data` that tells the shared webhook this session is
 * a fan age check, not a creator KYC run. The suffix is our evidence row id.
 */
export const AGE_VENDOR_DATA_PREFIX = "age:";

export interface AssuranceCookie {
  name: string;
  value: string;
  options: {
    httpOnly: true;
    secure: boolean;
    sameSite: "lax";
    path: string;
    maxAge: number;
  };
}

/**
 * Holds the secret that lets the callback claim a passed check.
 *
 * Scoped to the callback's own path so it is not attached to ordinary page
 * loads, and `sameSite: "lax"` so it still rides the vendor's top-level
 * redirect back to us (a `strict` cookie would not be sent and every
 * verification would fail to convert).
 */
export const AGE_CLAIM_COOKIE = "fs_age_claim";
const AGE_CLAIM_COOKIE_PATH = "/api/age-assurance";

/**
 * Long enough to cover a document check that sits in manual review for a while,
 * short enough that a stale secret in a shared browser stops being claimable.
 */
const AGE_CLAIM_TTL_SECONDS = 2 * 60 * 60;

export interface AgeClaimCookie {
  name: string;
  value: string;
  options: {
    httpOnly: true;
    secure: boolean;
    sameSite: "lax";
    path: string;
    maxAge: number;
  };
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function claimCookieOptions(maxAge: number): AgeClaimCookie["options"] {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: AGE_CLAIM_COOKIE_PATH,
    maxAge,
  };
}

/**
 * Mints the browser-binding secret for a new check.
 *
 * The cookie carries `<checkId>.<secret>` so the callback can reject a cookie
 * left over from an earlier attempt instead of failing an opaque hash compare.
 * Only the hash is persisted.
 */
export function buildAgeClaimCookie(checkId: string, secret: string): AgeClaimCookie {
  return {
    name: AGE_CLAIM_COOKIE,
    value: `${checkId}.${secret}`,
    options: claimCookieOptions(AGE_CLAIM_TTL_SECONDS),
  };
}

/** Expires the claim cookie once it has been spent (or definitively failed). */
export function expiredAgeClaimCookie(): AgeClaimCookie {
  return {
    name: AGE_CLAIM_COOKIE,
    value: "",
    options: claimCookieOptions(0),
  };
}

/** Pulls the secret out of the claim cookie, if it is for this very check. */
export function readAgeClaimSecret(
  cookieValue: string | undefined,
  checkId: string
): string | null {
  if (!cookieValue) return null;
  const separator = cookieValue.indexOf(".");
  if (separator <= 0) return null;

  const cookieCheckId = cookieValue.slice(0, separator);
  const secret = cookieValue.slice(separator + 1);
  if (!secret) return null;

  const expected = Buffer.from(checkId);
  const actual = Buffer.from(cookieCheckId);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  return secret;
}

/** SHA-256 of the client IP, matching the scheme already used by 037. */
export function hashClientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  const raw = forwarded?.split(",")[0]?.trim() ?? headers.get("x-real-ip")?.trim();
  if (!raw) return null;
  return sha256Hex(raw);
}

/**
 * Opens a pending evidence row before redirecting the visitor to the vendor.
 * Recording the intent up front means an abandoned verification is visible as
 * `pending` rather than leaving no trace at all.
 */
export async function recordAssuranceStart(params: {
  requiredTier: Exclude<AccessTier, "blocked">;
  method: AssuranceMethod;
  provider: string | null;
  providerSessionId: string | null;
  geo: GeoContext;
  ipHash: string | null;
  userAgent: string | null;
  userId: string | null;
  /** SHA-256 of the secret the callback must present. See migration 054. */
  claimSecretHash: string | null;
}): Promise<string | null> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("age_assurance_checks")
    .insert({
      user_id: params.userId,
      required_tier: params.requiredTier,
      method: params.method,
      status: "pending",
      provider: params.provider,
      provider_session_id: params.providerSessionId,
      country: params.geo.country,
      region: params.geo.region,
      ip_hash: params.ipHash,
      user_agent: params.userAgent?.slice(0, 500) ?? null,
      claim_secret_hash: params.claimSecretHash,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[age-assurance] failed to record start:", error);
    return null;
  }
  return data.id as string;
}

/** Marks an evidence row terminal. Returns the row's expiry when it passed. */
export async function resolveAssuranceCheck(params: {
  checkId: string;
  passed: boolean;
  method?: AssuranceMethod;
}): Promise<{ expiresAt: Date } | null> {
  const admin = getSupabaseAdminClient();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + AGE_ASSURANCE_TTL_HOURS * 60 * 60 * 1000);

  const { error } = await admin
    .from("age_assurance_checks")
    .update({
      status: params.passed ? "passed" : "failed",
      ...(params.method ? { method: params.method } : {}),
      verified_at: params.passed ? now.toISOString() : null,
      expires_at: params.passed ? expiresAt.toISOString() : null,
      updated_at: now.toISOString(),
    })
    .eq("id", params.checkId);

  if (error) {
    console.error("[age-assurance] failed to resolve check:", error);
    return null;
  }

  return params.passed ? { expiresAt } : null;
}

/**
 * Spends a passed check so it can mint exactly one gate cookie.
 *
 * Everything that makes this safe lives in the WHERE clause of a single UPDATE:
 * the check must have passed, the caller must hold the secret minted at start,
 * and it must not have been claimed before. Postgres serialises writers to a
 * row, so two requests arriving together cannot both match `claimed_at IS NULL`
 * — the loser updates nothing and is refused. Doing the read and the write as
 * separate statements would reopen exactly that race.
 */
export async function claimPassedAgeCheck(checkId: string, secret: string): Promise<boolean> {
  const admin = getSupabaseAdminClient();
  const now = new Date().toISOString();

  const { data, error } = await admin
    .from("age_assurance_checks")
    .update({ claimed_at: now, updated_at: now })
    .eq("id", checkId)
    .eq("status", "passed")
    .eq("claim_secret_hash", sha256Hex(secret))
    .is("claimed_at", null)
    .select("id");

  if (error) {
    console.error("[age-assurance] failed to claim check:", error);
    return false;
  }

  return (data?.length ?? 0) > 0;
}

/**
 * Builds the cookie that actually opens the gate.
 *
 * Returns null when no signing secret is configured. Callers must surface that
 * as a failure rather than letting the visitor through: an unsigned gate is no
 * gate, and the whole point of Tier B/C is that the check is enforceable.
 */
export async function buildAssuranceCookie(params: {
  checkId: string;
  method: AssuranceMethod;
  country: string | null;
  expiresAt: Date;
}): Promise<AssuranceCookie | null> {
  const secret = getAssuranceSecret();
  if (!secret) {
    console.error("[age-assurance] AGE_ASSURANCE_SECRET is not configured — cannot issue cookie");
    return null;
  }

  const exp = Math.floor(params.expiresAt.getTime() / 1000);
  const value = await signAssuranceToken(
    { sid: params.checkId, m: params.method, exp, cc: params.country },
    secret
  );

  return {
    name: AGE_ASSURANCE_COOKIE,
    value,
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: AGE_ASSURANCE_TTL_HOURS * 60 * 60,
    },
  };
}

// ── Vendor flow ──────────────────────────────────────────────────────────────

function getAgeWorkflowId(method: VendorAssuranceMethod): string | null {
  const id =
    method === "age_estimation"
      ? env.DIDIT_AGE_ESTIMATION_WORKFLOW_ID
      : env.DIDIT_AGE_DOCUMENT_WORKFLOW_ID;
  return id && id.length > 0 ? id : null;
}

/**
 * Opens a vendor verification session and returns the hosted URL to send the
 * visitor to.
 *
 * The evidence row is written *before* the vendor call so the callback has a
 * stable id to come back to, and so an abandoned attempt still leaves a trace.
 */
export async function startVendorAgeCheck(params: {
  requiredTier: Exclude<AccessTier, "blocked">;
  method: VendorAssuranceMethod;
  geo: GeoContext;
  ipHash: string | null;
  userAgent: string | null;
  userId: string | null;
  /** Path to return the visitor to once verified. Already validated by caller. */
  next: string;
  /**
   * Origin to build the vendor callback on. Must be the origin that will set
   * the claim cookie (i.e. the caller's own request origin) — the cookie is
   * host-only, so a callback pointed at a different host never receives it.
   */
  siteUrl: string;
}): Promise<{ checkId: string; url: string; claimSecret: string } | { error: string }> {
  const workflowId = getAgeWorkflowId(params.method);
  if (!workflowId) {
    return { error: "Age verification is not configured for this method" };
  }

  const claimSecret = randomBytes(32).toString("base64url");

  const checkId = await recordAssuranceStart({
    requiredTier: params.requiredTier,
    method: params.method,
    provider: "didit",
    providerSessionId: null,
    geo: params.geo,
    ipHash: params.ipHash,
    userAgent: params.userAgent,
    userId: params.userId,
    claimSecretHash: sha256Hex(claimSecret),
  });

  if (!checkId) {
    return { error: "Could not start verification" };
  }

  const callbackUrl = new URL("/api/age-assurance/callback", params.siteUrl);
  callbackUrl.searchParams.set("check", checkId);
  callbackUrl.searchParams.set("next", params.next);

  let session;
  try {
    session = await createDiditSession({
      workflowId,
      vendorData: `${AGE_VENDOR_DATA_PREFIX}${checkId}`,
      callbackUrl: callbackUrl.toString(),
      metadata: { purpose: "age_assurance", method: params.method },
    });
  } catch (err) {
    console.error("[age-assurance] vendor session creation failed:", err);
    await resolveAssuranceCheck({ checkId, passed: false });
    return { error: "Verification provider is unavailable" };
  }

  const admin = getSupabaseAdminClient();
  await admin
    .from("age_assurance_checks")
    .update({ provider_session_id: session.session_id, updated_at: new Date().toISOString() })
    .eq("id", checkId);

  return { checkId, url: session.verification_url, claimSecret };
}

export type AgeDecisionOutcome = "passed" | "failed" | "pending";

/**
 * Didit v3 session statuses, reduced to what the gate cares about.
 * "In Review" is a real state for document checks — it must not be treated as
 * a pass, and must not be treated as a permanent failure either.
 */
export function interpretDiditAgeStatus(status: string | undefined): AgeDecisionOutcome {
  switch (status) {
    case "Approved":
      return "passed";
    case "Declined":
    case "Expired":
    case "Abandoned":
      return "failed";
    default:
      return "pending";
  }
}

interface AgeCheckRow {
  id: string;
  method: AssuranceMethod;
  status: string;
  country: string | null;
  provider_session_id: string | null;
  expires_at: string | null;
}

export async function getAgeCheck(checkId: string): Promise<AgeCheckRow | null> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("age_assurance_checks")
    .select("id, method, status, country, provider_session_id, expires_at")
    .eq("id", checkId)
    .maybeSingle();

  if (error) {
    console.error("[age-assurance] failed to load check:", error);
    return null;
  }
  return (data as AgeCheckRow | null) ?? null;
}

/**
 * Pulls the vendor's decision for a check and settles the evidence row.
 *
 * Called from the browser callback. The webhook calls
 * `applyVendorAgeDecision` instead — whichever arrives first wins and the other
 * is a no-op, because a settled row is never re-opened.
 */
export async function finaliseVendorAgeCheck(
  checkId: string
): Promise<{ outcome: AgeDecisionOutcome; method: AssuranceMethod; country: string | null }> {
  const row = await getAgeCheck(checkId);
  if (!row) return { outcome: "failed", method: "age_estimation", country: null };

  if (row.status === "passed") {
    return { outcome: "passed", method: row.method, country: row.country };
  }
  if (row.status === "failed") {
    return { outcome: "failed", method: row.method, country: row.country };
  }
  if (!row.provider_session_id) {
    return { outcome: "pending", method: row.method, country: row.country };
  }

  let decision: Record<string, unknown> | null;
  try {
    decision = await getDiditSessionDecision(row.provider_session_id);
  } catch (err) {
    console.error("[age-assurance] decision fetch failed:", err);
    return { outcome: "pending", method: row.method, country: row.country };
  }

  const outcome = interpretDiditAgeStatus(decision?.status as string | undefined);
  if (outcome !== "pending") {
    await resolveAssuranceCheck({ checkId, passed: outcome === "passed" });
  }

  return { outcome, method: row.method, country: row.country };
}

/**
 * Settles an evidence row straight from a signature-verified webhook payload,
 * so a visitor whose decision lands after they close the tab is still recorded.
 */
export async function applyVendorAgeDecision(
  vendorData: string,
  status: string
): Promise<{ handled: boolean }> {
  if (!vendorData.startsWith(AGE_VENDOR_DATA_PREFIX)) return { handled: false };

  const checkId = vendorData.slice(AGE_VENDOR_DATA_PREFIX.length);
  const outcome = interpretDiditAgeStatus(status);
  if (outcome === "pending") return { handled: true };

  const row = await getAgeCheck(checkId);
  if (!row || row.status === "passed" || row.status === "failed") return { handled: true };

  await resolveAssuranceCheck({ checkId, passed: outcome === "passed" });
  return { handled: true };
}
