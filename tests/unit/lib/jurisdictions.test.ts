import { describe, it, expect } from "vitest";
import {
  resolveJurisdiction,
  readGeoFromHeaders,
  requiresVerifiedAssurance,
  AGE_VERIFICATION_US_STATES,
  EXCLUDED_US_STATES,
} from "@/lib/compliance/jurisdictions";
import {
  methodSatisfiesTier,
  methodSatisfiesJurisdiction,
  signAssuranceToken,
  verifyAssuranceToken,
} from "@/lib/compliance/assurance-token";

const SECRET = "test-secret-that-is-at-least-32-characters-long";

describe("resolveJurisdiction — Tier 0 blocking", () => {
  it.each(["KP", "IR", "SY", "CU", "RU", "BY"])("blocks sanctioned country %s", (country) => {
    const decision = resolveJurisdiction({ country, region: null });
    expect(decision.tier).toBe("blocked");
    expect(decision.blockReason).toBe("sanctions");
  });

  it("blocks occupied Ukrainian oblasts but not the rest of Ukraine", () => {
    expect(resolveJurisdiction({ country: "UA", region: "43" }).tier).toBe("blocked");
    expect(resolveJurisdiction({ country: "UA", region: "14" }).tier).toBe("blocked");
    expect(resolveJurisdiction({ country: "UA", region: "32" }).tier).not.toBe("blocked");
  });

  it.each(["CN", "SA", "AE", "TR", "KR", "ID"])(
    "blocks %s where adult content is illegal or ISP-blocked",
    (country) => {
      const decision = resolveJurisdiction({ country, region: null });
      expect(decision.tier).toBe("blocked");
      expect(decision.blockReason).toBe("adult_content_illegal");
    }
  );

  it("blocks Tennessee and only Tennessee among US states", () => {
    const tn = resolveJurisdiction({ country: "US", region: "TN" });
    expect(tn.tier).toBe("blocked");
    expect(tn.blockReason).toBe("state_excluded");
    expect(EXCLUDED_US_STATES).toEqual(["TN"]);
    expect(AGE_VERIFICATION_US_STATES).not.toContain("TN");
  });

  it("never allows payments or creator signup from a blocked jurisdiction", () => {
    const decision = resolveJurisdiction({ country: "IR", region: null });
    expect(decision.paymentsAllowed).toBe(false);
    expect(decision.creatorSignupAllowed).toBe(false);
  });
});

describe("resolveJurisdiction — tier routing", () => {
  it("routes the 26 legislated US states to document tier", () => {
    expect(AGE_VERIFICATION_US_STATES).toHaveLength(26);
    for (const region of AGE_VERIFICATION_US_STATES) {
      expect(resolveJurisdiction({ country: "US", region }).tier).toBe("document");
    }
  });

  it("routes non-legislated US states to self-attestation", () => {
    expect(resolveJurisdiction({ country: "US", region: "CA" }).tier).toBe("self_attest");
    expect(resolveJurisdiction({ country: "US", region: "NY" }).tier).toBe("self_attest");
  });

  it.each(["GB", "AU", "BR", "FR", "DE", "IT"])("routes %s to facial age estimation", (country) => {
    expect(resolveJurisdiction({ country, region: null }).tier).toBe("age_estimation");
  });

  it("requires an anonymous option only in Florida", () => {
    expect(resolveJurisdiction({ country: "US", region: "FL" }).anonymousOptionRequired).toBe(true);
    expect(resolveJurisdiction({ country: "US", region: "TX" }).anonymousOptionRequired).toBe(
      false
    );
  });

  it("sets a 24h re-verification window wherever a real check is required", () => {
    expect(resolveJurisdiction({ country: "US", region: "OH" }).reverifyIntervalHours).toBe(24);
    expect(resolveJurisdiction({ country: "GB", region: null }).reverifyIntervalHours).toBe(24);
    expect(resolveJurisdiction({ country: "CA", region: null }).reverifyIntervalHours).toBeNull();
  });
});

describe("resolveJurisdiction — payments and creator eligibility", () => {
  it("allows payments from the US only", () => {
    expect(resolveJurisdiction({ country: "US", region: "TX" }).paymentsAllowed).toBe(true);
    expect(resolveJurisdiction({ country: "GB", region: null }).paymentsAllowed).toBe(false);
    expect(resolveJurisdiction({ country: "FR", region: null }).paymentsAllowed).toBe(false);
    expect(resolveJurisdiction({ country: "CA", region: null }).paymentsAllowed).toBe(false);
  });

  it("refuses payments when the country cannot be determined", () => {
    const decision = resolveJurisdiction({ country: null, region: null });
    expect(decision.tier).toBe("self_attest");
    expect(decision.paymentsAllowed).toBe(false);
  });

  // Every US-specific rule keys off `region`, so an unresolved subdivision used
  // to fall through to self-attestation with payments enabled — handing the most
  // permissive outcome to precisely the visitors who might be in Tennessee.
  it("refuses payments from the US when the state cannot be determined", () => {
    expect(resolveJurisdiction({ country: "US", region: null }).paymentsAllowed).toBe(false);
  });

  it("applies the strictest US tier when the state cannot be determined", () => {
    const decision = resolveJurisdiction({ country: "US", region: null });
    expect(decision.tier).toBe("document");
    expect(decision.anonymousOptionRequired).toBe(true);
    expect(decision.reverifyIntervalHours).toBe(24);
    // Not blocked: a thin edge header is not evidence of an excluded state.
    expect(decision.blockReason).toBeNull();
  });

  it("lets Indian fans browse but not onboard as creators", () => {
    const decision = resolveJurisdiction({ country: "IN", region: null });
    expect(decision.tier).not.toBe("blocked");
    expect(decision.creatorSignupAllowed).toBe(false);
  });
});

describe("readGeoFromHeaders", () => {
  it("reads Vercel headers and strips the country prefix from the region", () => {
    const headers = new Headers({
      "x-vercel-ip-country": "us",
      "x-vercel-ip-country-region": "US-TX",
    });
    expect(readGeoFromHeaders(headers)).toEqual({ country: "US", region: "TX" });
  });

  it("falls back to Cloudflare headers", () => {
    const headers = new Headers({ "cf-ipcountry": "gb", "cf-region-code": "eng" });
    expect(readGeoFromHeaders(headers)).toEqual({ country: "GB", region: "ENG" });
  });

  it("returns nulls when no edge headers are present", () => {
    expect(readGeoFromHeaders(new Headers())).toEqual({ country: null, region: null });
  });
});

describe("assurance token", () => {
  it("round-trips a signed payload", async () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const token = await signAssuranceToken({ sid: "abc", m: "document", exp, cc: "US" }, SECRET);
    const payload = await verifyAssuranceToken(token, SECRET);
    expect(payload).toMatchObject({ sid: "abc", m: "document", cc: "US" });
  });

  it("rejects a tampered payload", async () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const token = await signAssuranceToken(
      { sid: "abc", m: "age_estimation", exp, cc: "GB" },
      SECRET
    );
    const [body, signature] = token.split(".");
    const forged = `${body}x.${signature}`;
    expect(await verifyAssuranceToken(forged, SECRET)).toBeNull();
  });

  it("rejects a token signed with a different secret", async () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const token = await signAssuranceToken({ sid: "abc", m: "document", exp, cc: "US" }, SECRET);
    expect(await verifyAssuranceToken(token, `${SECRET}-other`)).toBeNull();
  });

  it("rejects an expired token", async () => {
    const exp = Math.floor(Date.now() / 1000) - 1;
    const token = await signAssuranceToken({ sid: "abc", m: "document", exp, cc: "US" }, SECRET);
    expect(await verifyAssuranceToken(token, SECRET)).toBeNull();
  });

  it("treats a missing token as no assurance", async () => {
    expect(await verifyAssuranceToken(undefined, SECRET)).toBeNull();
    expect(await verifyAssuranceToken("", SECRET)).toBeNull();
  });
});

describe("method sufficiency", () => {
  it("does not let a UK facial estimate satisfy a Texas document requirement", () => {
    expect(methodSatisfiesTier("age_estimation", "document")).toBe(false);
    expect(
      methodSatisfiesJurisdiction(
        "age_estimation",
        resolveJurisdiction({ country: "US", region: "TX" })
      )
    ).toBe(false);
  });

  it("accepts a facial estimate in Florida because an anonymous option is mandated", () => {
    expect(
      methodSatisfiesJurisdiction(
        "age_estimation",
        resolveJurisdiction({ country: "US", region: "FL" })
      )
    ).toBe(true);
  });

  it("accepts a stronger method than required", () => {
    expect(methodSatisfiesTier("document", "age_estimation")).toBe(true);
    expect(methodSatisfiesTier("database", "document")).toBe(true);
  });

  it("never accepts self-attestation where a real check is required", () => {
    expect(methodSatisfiesTier("self_attest", "age_estimation")).toBe(false);
    expect(methodSatisfiesTier("self_attest", "document")).toBe(false);
    expect(requiresVerifiedAssurance("self_attest")).toBe(false);
    expect(requiresVerifiedAssurance("age_estimation")).toBe(true);
    expect(requiresVerifiedAssurance("document")).toBe(true);
  });
});
