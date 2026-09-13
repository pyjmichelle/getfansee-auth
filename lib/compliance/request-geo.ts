/**
 * Request-scoped geo resolution with a test-only override.
 *
 * Geo blocking is only exercisable in CI if tests can pretend to originate
 * anywhere, but a header-driven override in production would let anyone bypass
 * sanctions blocking by setting a header. The override is therefore gated on
 * the same test-mode flags the rest of the codebase already uses, all of which
 * are false in a production deployment.
 */

import { readGeoFromHeaders, resolveJurisdiction } from "./jurisdictions";
import type { GeoContext, JurisdictionDecision } from "./jurisdictions";

export const TEST_GEO_COUNTRY_HEADER = "x-gfs-test-country";
export const TEST_GEO_REGION_HEADER = "x-gfs-test-region";

function isGeoOverrideAllowed(): boolean {
  return (
    process.env.E2E === "1" ||
    process.env.PLAYWRIGHT_TEST_MODE === "true" ||
    process.env.NEXT_PUBLIC_TEST_MODE === "true" ||
    process.env.NODE_ENV === "development"
  );
}

export function getRequestGeo(headers: Headers): GeoContext {
  if (isGeoOverrideAllowed()) {
    const country = headers.get(TEST_GEO_COUNTRY_HEADER)?.trim().toUpperCase();
    if (country) {
      const region = headers.get(TEST_GEO_REGION_HEADER)?.trim().toUpperCase();
      return { country, region: region && region.length > 0 ? region : null };
    }
  }
  return readGeoFromHeaders(headers);
}

export function getRequestJurisdiction(headers: Headers): JurisdictionDecision {
  return resolveJurisdiction(getRequestGeo(headers));
}
