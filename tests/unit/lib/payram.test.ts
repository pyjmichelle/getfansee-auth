import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHmac } from "crypto";

/**
 * These tests exist because every one of them corresponds to a way real money
 * could be lost or duplicated:
 *
 *   - a forged webhook credits a wallet that was never funded
 *   - a re-serialised body breaks verification for legitimate payments
 *   - a non-terminal state credits before the money has arrived
 *   - an unparseable amount credits the wrong number
 *   - a misread status field discards every delivery, so a paid deposit is
 *     never credited and nothing anywhere reports a problem
 *
 * The fixtures below are shaped like real deliveries: the fill state arrives as
 * `status` and monetary amounts arrive as JSON strings.
 */

const KEY = "test_payram_api_key";

function sign(body: string, key = KEY): string {
  return "sha256=" + createHmac("sha256", key).update(body, "utf8").digest("hex");
}

describe("payram", () => {
  let payram: typeof import("@/lib/payram");

  beforeEach(async () => {
    process.env.PAYRAM_API_KEY = KEY;
    process.env.PAYRAM_BASE_URL = "https://payram.test";
    delete process.env.PAYRAM_WEBHOOK_SECRET;
    payram = await import("@/lib/payram");
  });

  afterEach(() => {
    delete process.env.PAYRAM_ENABLED;
    delete process.env.PAYRAM_API_KEY;
    delete process.env.PAYRAM_BASE_URL;
    delete process.env.PAYRAM_WEBHOOK_SECRET;
  });

  describe("verifyPayramSignature", () => {
    it("accepts a signature over the exact raw body", () => {
      const body = '{"reference_id":"ref_1","status":"FILLED","filled_amount_in_usd":"20"}';
      expect(payram.verifyPayramSignature(body, sign(body))).toBe(true);
    });

    it("accepts the bare hex digest without the sha256= prefix", () => {
      const body = '{"reference_id":"ref_1","status":"FILLED"}';
      const bare = sign(body).slice("sha256=".length);
      expect(payram.verifyPayramSignature(body, bare)).toBe(true);
    });

    it("rejects a body that was re-serialised after parsing", () => {
      // The canonical trap: JSON.parse -> JSON.stringify round-trips produce
      // different bytes (key order, spacing, number formatting) for the same
      // logical payload. Verification must happen on what arrived on the wire.
      const wire = '{"reference_id":"ref_1", "status":"FILLED", "filled_amount_in_usd":20.00}';
      const signature = sign(wire);
      const reSerialised = JSON.stringify(JSON.parse(wire));
      expect(reSerialised).not.toBe(wire);
      expect(payram.verifyPayramSignature(reSerialised, signature)).toBe(false);
    });

    it("rejects a tampered amount", () => {
      const original = '{"reference_id":"ref_1","status":"FILLED","filled_amount_in_usd":"20"}';
      const tampered = '{"reference_id":"ref_1","status":"FILLED","filled_amount_in_usd":"2000"}';
      expect(payram.verifyPayramSignature(tampered, sign(original))).toBe(false);
    });

    it("rejects a signature made with a different key", () => {
      const body = '{"reference_id":"ref_1","status":"FILLED"}';
      expect(payram.verifyPayramSignature(body, sign(body, "wrong_key"))).toBe(false);
    });

    it("rejects a missing signature header", () => {
      expect(payram.verifyPayramSignature("{}", null)).toBe(false);
    });

    it("prefers PAYRAM_WEBHOOK_SECRET when it is set", () => {
      process.env.PAYRAM_WEBHOOK_SECRET = "separate_signing_key";
      const body = '{"reference_id":"ref_1","status":"FILLED"}';
      expect(payram.verifyPayramSignature(body, sign(body, "separate_signing_key"))).toBe(true);
      expect(payram.verifyPayramSignature(body, sign(body, KEY))).toBe(false);
    });
  });

  describe("terminal states", () => {
    it("credits only on FILLED and OVER_FILLED", () => {
      expect(payram.PAYRAM_TERMINAL_CREDIT_STATES).toEqual(["FILLED", "OVER_FILLED"]);
    });

    it("does not treat PARTIALLY_FILLED as creditable", () => {
      expect(payram.PAYRAM_TERMINAL_CREDIT_STATES).not.toContain("PARTIALLY_FILLED");
    });
  });

  describe("resolvePayramState", () => {
    it("reads the fill state from `status`, as PayRam actually sends it", () => {
      expect(payram.resolvePayramState({ status: "FILLED" })).toBe("FILLED");
      expect(payram.resolvePayramState({ status: "OVER_FILLED" })).toBe("OVER_FILLED");
      expect(payram.resolvePayramState({ status: "PARTIALLY_FILLED" })).toBe("PARTIALLY_FILLED");
      expect(payram.resolvePayramState({ status: "OPEN" })).toBe("OPEN");
      expect(payram.resolvePayramState({ status: "CANCELLED" })).toBe("CANCELLED");
    });

    it("does not accept the state under a `state` key", () => {
      // The original integration read `payload.state`, which PayRam never
      // sends. That fails open in the worst way: undefined is not a known
      // state, every delivery is discarded as unknown, and a fan who paid is
      // never credited — with nothing in the logs to say money went missing.
      expect(payram.resolvePayramState({ state: "FILLED" } as { status?: unknown })).toBeNull();
    });

    it("returns null for a missing, non-string or undocumented status", () => {
      expect(payram.resolvePayramState({})).toBeNull();
      expect(payram.resolvePayramState({ status: undefined })).toBeNull();
      expect(payram.resolvePayramState({ status: null })).toBeNull();
      expect(payram.resolvePayramState({ status: 1 })).toBeNull();
      expect(payram.resolvePayramState({ status: "SETTLED" })).toBeNull();
      // Case matters: PayRam sends upper case, and silently accepting other
      // casings would let an unknown vocabulary through as if understood.
      expect(payram.resolvePayramState({ status: "filled" })).toBeNull();
    });
  });

  describe("parseUsdToCents", () => {
    it("handles numbers and decimal strings identically", () => {
      expect(payram.parseUsdToCents(20)).toBe(2000);
      expect(payram.parseUsdToCents("20.00")).toBe(2000);
      expect(payram.parseUsdToCents("19.995")).toBe(2000);
      expect(payram.parseUsdToCents(0)).toBe(0);
    });

    it("returns null rather than a number for anything unreadable", () => {
      // null is load-bearing: the webhook refuses to credit on null, whereas a
      // 0 would silently credit nothing and mark the order settled.
      expect(payram.parseUsdToCents(undefined)).toBeNull();
      expect(payram.parseUsdToCents(null)).toBeNull();
      expect(payram.parseUsdToCents("")).toBeNull();
      expect(payram.parseUsdToCents("not a number")).toBeNull();
      expect(payram.parseUsdToCents(-5)).toBeNull();
    });
  });

  describe("top-up tiers", () => {
    it("accepts only the fixed tiers", () => {
      expect(payram.isValidTopupTier(20)).toBe(true);
      expect(payram.isValidTopupTier(50)).toBe(true);
      expect(payram.isValidTopupTier(100)).toBe(true);
    });

    it("rejects amounts below the onramp minimum and arbitrary amounts", () => {
      expect(payram.isValidTopupTier(1.99)).toBe(false);
      expect(payram.isValidTopupTier(37)).toBe(false);
      expect(payram.isValidTopupTier("20")).toBe(false);
      expect(payram.isValidTopupTier(null)).toBe(false);
    });
  });

  describe("isPayramEnabled", () => {
    it("is off unless explicitly enabled and fully configured", () => {
      expect(payram.isPayramEnabled()).toBe(false);

      process.env.PAYRAM_ENABLED = "true";
      expect(payram.isPayramEnabled()).toBe(true);

      delete process.env.PAYRAM_API_KEY;
      expect(payram.isPayramEnabled()).toBe(false);
    });
  });
});
