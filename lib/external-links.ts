/**
 * Creator external links — shared validation & types (Pre-Payment Alpha).
 *
 * Creators may attach up to MAX_LINKS_PER_CREATOR external links to their
 * public profile. Every link is reviewed by an admin before display, and the
 * URL host must match the domain allowlist below.
 */

export const MAX_LINKS_PER_CREATOR = 5;

/** Domains a creator link may point to (subdomains allowed). */
export const EXTERNAL_LINK_ALLOWED_DOMAINS = [
  "onlyfans.com",
  "fansly.com",
  "fanvue.com",
  "linktr.ee",
  "beacons.ai",
  "allmylinks.com",
  "instagram.com",
  "x.com",
  "twitter.com",
  "tiktok.com",
  "youtube.com",
  "twitch.tv",
  "reddit.com",
] as const;

export type ExternalLinkStatus = "pending" | "approved" | "rejected";

export interface CreatorExternalLink {
  id: string;
  creator_id: string;
  url: string;
  label: string;
  status: ExternalLinkStatus;
  click_count: number;
  rejection_reason?: string | null;
  created_at: string;
}

/** Public-safe projection used on creator profiles. */
export interface PublicExternalLink {
  id: string;
  url: string;
  label: string;
}

export function isAllowedExternalLinkDomain(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return EXTERNAL_LINK_ALLOWED_DOMAINS.some(
      (domain) => host === domain || host.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

export interface ExternalLinkInput {
  url: string;
  label: string;
}

export function validateExternalLinkInput(
  body: unknown
): { ok: true; value: ExternalLinkInput } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Invalid request body" };
  }
  const { url, label } = body as { url?: unknown; label?: unknown };

  if (typeof url !== "string" || url.length === 0) {
    return { ok: false, error: "URL is required" };
  }
  if (url.length > 500) {
    return { ok: false, error: "URL is too long" };
  }
  if (!url.startsWith("https://")) {
    return { ok: false, error: "URL must use https://" };
  }
  try {
    new URL(url);
  } catch {
    return { ok: false, error: "URL is not valid" };
  }
  if (!isAllowedExternalLinkDomain(url)) {
    return {
      ok: false,
      error: "This domain is not on the approved list. Contact support to request a new domain.",
    };
  }

  if (typeof label !== "string" || label.trim().length === 0) {
    return { ok: false, error: "Label is required" };
  }
  if (label.trim().length > 40) {
    return { ok: false, error: "Label must be 40 characters or fewer" };
  }

  return { ok: true, value: { url, label: label.trim() } };
}
