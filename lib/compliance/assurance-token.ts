/**
 * Signed age-assurance token.
 *
 * The gate has to run in Edge middleware on every request, which rules out a
 * database lookup per page view. So the *proof* a visitor carries is a stateless
 * HMAC-signed cookie, and the *evidence* we retain for regulators is a row in
 * `age_assurance_checks`. The cookie can be verified in microseconds with no
 * network call; the row is what an auditor reads.
 *
 * Uses Web Crypto (not node:crypto) so the same code runs in the Edge runtime,
 * in Node route handlers, and under Vitest.
 */

import type { AccessTier, JurisdictionDecision } from "./jurisdictions";

/** How the visitor's age was established. Ordered weakest → strongest. */
export type AssuranceMethod = "self_attest" | "age_estimation" | "document" | "database";

export interface AssurancePayload {
  /** Assurance record id — correlates the cookie to its audit row. */
  sid: string;
  /** Method actually used, which may be stronger than the tier required. */
  m: AssuranceMethod;
  /** Expiry, unix seconds. */
  exp: number;
  /** Country the check was performed from, for audit and travel detection. */
  cc: string | null;
}

export const AGE_ASSURANCE_COOKIE = "gfs_age_assurance";

const METHOD_STRENGTH: Record<AssuranceMethod, number> = {
  self_attest: 0,
  age_estimation: 1,
  document: 2,
  database: 2,
};

const TIER_REQUIRED_STRENGTH: Record<AccessTier, number> = {
  blocked: Number.POSITIVE_INFINITY,
  self_attest: 0,
  age_estimation: 1,
  document: 2,
};

/** Does a check performed with `method` satisfy what `tier` demands? */
export function methodSatisfiesTier(method: AssuranceMethod, tier: AccessTier): boolean {
  return METHOD_STRENGTH[method] >= TIER_REQUIRED_STRENGTH[tier];
}

/**
 * Tier strength alone is not the whole rule. Florida mandates an anonymous
 * verification option, and facial age estimation is the one method that
 * predicts an age without resolving an identity — so there it is sufficient on
 * its own even though the state is otherwise a document-tier jurisdiction.
 */
export function methodSatisfiesJurisdiction(
  method: AssuranceMethod,
  decision: Pick<JurisdictionDecision, "tier" | "anonymousOptionRequired">
): boolean {
  if (decision.anonymousOptionRequired && method === "age_estimation") return true;
  return methodSatisfiesTier(method, decision.tier);
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, "="));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

/**
 * The signing secret. Absent secret means no token can ever verify, which
 * fail-closes Tier B/C markets rather than silently downgrading them to an
 * unsigned "trust the cookie" gate.
 */
export function getAssuranceSecret(): string | null {
  const secret = process.env.AGE_ASSURANCE_SECRET;
  return secret && secret.length >= 32 ? secret : null;
}

export async function signAssuranceToken(
  payload: AssurancePayload,
  secret: string
): Promise<string> {
  const body = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await importKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return `${body}.${base64UrlEncode(new Uint8Array(signature))}`;
}

/**
 * Verifies signature and expiry. Returns null on any failure — callers must
 * treat null as "no assurance", never as "assume the weakest tier".
 */
export async function verifyAssuranceToken(
  token: string | undefined | null,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): Promise<AssurancePayload | null> {
  if (!token) return null;

  const separator = token.lastIndexOf(".");
  if (separator <= 0) return null;

  const body = token.slice(0, separator);
  const signature = token.slice(separator + 1);

  let valid: boolean;
  try {
    const key = await importKey(secret);
    valid = await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlDecode(signature) as unknown as ArrayBuffer,
      new TextEncoder().encode(body)
    );
  } catch {
    return null;
  }
  if (!valid) return null;

  let payload: AssurancePayload;
  try {
    payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(body))) as AssurancePayload;
  } catch {
    return null;
  }

  if (typeof payload.exp !== "number" || payload.exp <= nowSeconds) return null;
  if (!(payload.m in METHOD_STRENGTH)) return null;

  return payload;
}
