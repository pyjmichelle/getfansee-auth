/**
 * Jurisdiction routing — the single source of truth for "what is this visitor
 * allowed to do, and how hard do we have to check their age".
 *
 * Four tiers, resolved from the edge-provided geo headers:
 *
 *   Tier 0 (blocked)         — sanctions, adult content illegal, or a state
 *                              whose compliance cost exceeds its revenue.
 *   Tier A (self_attest)     — the existing "I am 18+" gate is sufficient.
 *   Tier B (age_estimation)  — facial age estimation required before adult
 *                              content is served (UK OSA, AU codes, EU, BR).
 *   Tier C (document)        — a statutorily enumerated method required
 *                              (26 US states with age-verification laws).
 *
 * This module is pure data + pure functions so it can run in the Edge
 * middleware runtime, in route handlers, and in unit tests alike. It must not
 * import anything with a Node-only or server-only dependency.
 */

export type AccessTier = "blocked" | "self_attest" | "age_estimation" | "document";

export type BlockReason = "sanctions" | "adult_content_illegal" | "state_excluded" | null;

export interface GeoContext {
  /** ISO 3166-1 alpha-2, uppercase. Null when the edge could not resolve it. */
  country: string | null;
  /** ISO 3166-2 subdivision code without the country prefix, uppercase. */
  region: string | null;
}

export interface JurisdictionDecision {
  tier: AccessTier;
  blockReason: BlockReason;
  /** May this visitor top up a wallet / spend money in-platform? */
  paymentsAllowed: boolean;
  /** May a creator from here onboard and be paid out? */
  creatorSignupAllowed: boolean;
  /**
   * Florida requires at least one verification option that does not identify
   * the user. Facial age estimation satisfies this because it predicts an age
   * without resolving an identity, so in Florida it is offered standalone and
   * document verification stays optional.
   */
  anonymousOptionRequired: boolean;
  /** Hours before a passed check must be repeated. Null = until session end. */
  reverifyIntervalHours: number | null;
}

// ── Tier 0: sanctions and embargo ────────────────────────────────────────────
// OFAC comprehensively sanctioned jurisdictions plus Russia/Belarus, which are
// also blocked at the platform level. Ukraine is NOT blocked — only the
// occupied oblasts are, handled by OCCUPIED_UA_REGIONS below.
export const SANCTIONED_COUNTRIES: readonly string[] = [
  "KP", // North Korea
  "IR", // Iran
  "SY", // Syria
  "CU", // Cuba
  "RU", // Russia
  "BY", // Belarus
];

/**
 * ISO 3166-2:UA subdivision codes for the occupied territories covered by the
 * Crimea / Donetsk / Luhansk sanctions programmes.
 */
export const OCCUPIED_UA_REGIONS: readonly string[] = [
  "43", // Autonomous Republic of Crimea
  "40", // Sevastopol
  "14", // Donetsk oblast
  "09", // Luhansk oblast
];

// ── Tier 0: adult content illegal or ISP-level blocked ───────────────────────
// Serving these markets cannot produce revenue (payment rails and ISPs block
// it) while creating real legal exposure for the operating entity.
export const ADULT_CONTENT_BLOCKED_COUNTRIES: readonly string[] = [
  "CN", // China
  "SA", // Saudi Arabia
  "AE", // United Arab Emirates
  "QA", // Qatar
  "KW", // Kuwait
  "BH", // Bahrain
  "IQ", // Iraq
  "AF", // Afghanistan
  "PK", // Pakistan
  "BD", // Bangladesh
  "TR", // Turkey
  "ID", // Indonesia
  "MY", // Malaysia
  "VN", // Vietnam
  "TH", // Thailand
  "EG", // Egypt
  "DZ", // Algeria
  "SD", // Sudan
  "AO", // Angola
  "KR", // South Korea
];

/**
 * Countries where fans may browse but creators may not onboard. India permits
 * consumption but criminalises local production of adult content, and Indian
 * banks systematically de-risk adult platforms — so payouts would fail even if
 * the legal question were clean.
 */
export const CREATOR_BLOCKED_COUNTRIES: readonly string[] = ["IN"];

// ── Tier 0: excluded US states ───────────────────────────────────────────────
/**
 * Tennessee. The Protect Tennessee Minors Act stacks three burdens found in no
 * other state: re-verification every 60 minutes of session time, Class C felony
 * liability for non-compliance (the only criminal-liability state), and a
 * mandate to retain seven years of anonymised verification data while retaining
 * no PII. Criminal exposure plus hourly re-verification costs more than a
 * single state can return.
 */
export const EXCLUDED_US_STATES: readonly string[] = ["TN"];

// ── Tier B: facial age estimation ────────────────────────────────────────────
const EU_MEMBER_STATES: readonly string[] = [
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
];

/**
 * GB — Online Safety Act, highly effective age assurance mandatory since
 *      2025-07-25. Ofcom explicitly accepts facial age estimation.
 * AU — Age-Restricted Material Codes, fully in force 2026-03-09. Self-
 *      attestation is no longer sufficient; penalties reach A$49.5m.
 * EU — France (SREN/Arcom), Germany and Italy already mandate it; DSA pressure
 *      makes a single EU-wide policy simpler than per-member-state routing.
 * BR — ECA Digital.
 */
export const AGE_ESTIMATION_COUNTRIES: readonly string[] = ["GB", "AU", "BR", ...EU_MEMBER_STATES];

// ── Tier C: US states with age-verification statutes ─────────────────────────
/**
 * The 27 states with age-verification laws, minus Tennessee (excluded above).
 * Configuration-driven on purpose: California AB 1043 (effective 2027),
 * Illinois and Colorado only require adding an entry here when they land.
 */
export const AGE_VERIFICATION_US_STATES: readonly string[] = [
  "AL",
  "AZ",
  "AR",
  "FL",
  "GA",
  "ID",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "MS",
  "MO",
  "MT",
  "NE",
  "NC",
  "ND",
  "OH",
  "OK",
  "SC",
  "SD",
  "TX",
  "UT",
  "VA",
  "WV",
  "WY",
];

/** Florida mandates an anonymous option; facial age estimation provides it. */
const ANONYMOUS_OPTION_STATES: readonly string[] = ["FL"];

/**
 * Ohio requires periodic re-verification but does not name an interval. A 24h
 * session TTL is applied platform-wide rather than only in Ohio, so there is
 * one code path and one thing to reason about.
 */
export const AGE_ASSURANCE_TTL_HOURS = 24;

// ── Payments ─────────────────────────────────────────────────────────────────
/**
 * MVP accepts money from the United States only.
 *
 * The EU applies VAT to digital services supplied by a non-EU seller from the
 * very first euro — there is no registration threshold — whereas US states
 * gate sales-tax obligations behind economic-nexus thresholds (typically
 * $100k or 200 transactions) that an MVP will not reach for some time. Other
 * regions keep free browsing plus creator off-platform links: no in-platform
 * sale means no VAT obligation.
 *
 * Opening EU payments later means registering for the Non-Union OSS (Ireland,
 * no fiscal representative needed, quarterly filing) and adding "EU" here.
 */
export const PAYMENT_ALLOWED_COUNTRIES: readonly string[] = ["US"];

// ─────────────────────────────────────────────────────────────────────────────

function normalise(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().toUpperCase();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Extracts the geo context from edge-provided request headers.
 *
 * Vercel sets x-vercel-ip-country / x-vercel-ip-country-region; Cloudflare sets
 * cf-ipcountry / cf-region-code. Locally neither exists and both fields are
 * null, which resolves to the permissive Tier A default — see
 * `resolveJurisdiction` for why that is the right failure mode for browsing
 * and the wrong one for money.
 */
export function readGeoFromHeaders(headers: Headers): GeoContext {
  const country =
    normalise(headers.get("x-vercel-ip-country")) ??
    normalise(headers.get("cf-ipcountry")) ??
    normalise(headers.get("x-country"));

  const region =
    normalise(headers.get("x-vercel-ip-country-region")) ??
    normalise(headers.get("cf-region-code")) ??
    normalise(headers.get("x-region"));

  // Some edges send the full ISO 3166-2 code ("US-TX"); keep only the
  // subdivision part so callers always compare against bare state codes.
  const bareRegion = region?.includes("-") ? (normalise(region.split("-").pop()) ?? null) : region;

  return { country, region: bareRegion };
}

/**
 * Resolves what a visitor from this location may do.
 *
 * Unknown country resolves to Tier A with payments disabled. Browsing cannot
 * be gated on data we do not have — a null country means the request did not
 * pass through a geo-aware edge (local dev, self-hosted preview), not that the
 * visitor is hiding. Money is the opposite: an unverifiable location must never
 * be able to transact, so `paymentsAllowed` requires a positive US match.
 */
export function resolveJurisdiction(geo: GeoContext): JurisdictionDecision {
  const { country, region } = geo;

  const blocked = (blockReason: BlockReason): JurisdictionDecision => ({
    tier: "blocked",
    blockReason,
    paymentsAllowed: false,
    creatorSignupAllowed: false,
    anonymousOptionRequired: false,
    reverifyIntervalHours: null,
  });

  if (country && SANCTIONED_COUNTRIES.includes(country)) {
    return blocked("sanctions");
  }

  if (country === "UA" && region && OCCUPIED_UA_REGIONS.includes(region)) {
    return blocked("sanctions");
  }

  if (country && ADULT_CONTENT_BLOCKED_COUNTRIES.includes(country)) {
    return blocked("adult_content_illegal");
  }

  if (country === "US" && region && EXCLUDED_US_STATES.includes(region)) {
    return blocked("state_excluded");
  }

  const paymentsAllowed = country !== null && PAYMENT_ALLOWED_COUNTRIES.includes(country);
  const creatorSignupAllowed = country === null || !CREATOR_BLOCKED_COUNTRIES.includes(country);

  if (country === "US" && region && AGE_VERIFICATION_US_STATES.includes(region)) {
    return {
      tier: "document",
      blockReason: null,
      paymentsAllowed,
      creatorSignupAllowed,
      anonymousOptionRequired: ANONYMOUS_OPTION_STATES.includes(region),
      reverifyIntervalHours: AGE_ASSURANCE_TTL_HOURS,
    };
  }

  if (country && AGE_ESTIMATION_COUNTRIES.includes(country)) {
    return {
      tier: "age_estimation",
      blockReason: null,
      paymentsAllowed,
      creatorSignupAllowed,
      anonymousOptionRequired: false,
      reverifyIntervalHours: AGE_ASSURANCE_TTL_HOURS,
    };
  }

  return {
    tier: "self_attest",
    blockReason: null,
    paymentsAllowed,
    creatorSignupAllowed,
    anonymousOptionRequired: false,
    reverifyIntervalHours: null,
  };
}

/** True when the tier requires a vendor-backed check rather than a checkbox. */
export function requiresVerifiedAssurance(tier: AccessTier): boolean {
  return tier === "age_estimation" || tier === "document";
}
