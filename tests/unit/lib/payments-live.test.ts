import { afterEach, describe, expect, it } from "vitest";
import {
  arePaymentsLive,
  isPayramCheckoutOpen,
  isPayramConfigured,
  unpairedPaymentFlagsError,
} from "@/lib/payments-live";

const KEYS = [
  "E2E",
  "PLAYWRIGHT_TEST_MODE",
  "NEXT_PUBLIC_TEST_MODE",
  "NODE_ENV",
  "NEXT_PUBLIC_CRYPTO_TOPUP_ENABLED",
  "PAYRAM_ENABLED",
  "PAYRAM_API_KEY",
  "PAYRAM_BASE_URL",
] as const;

const snapshot = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));

function resetEnv() {
  for (const key of KEYS) {
    if (snapshot[key] === undefined) delete process.env[key];
    else process.env[key] = snapshot[key];
  }
}

function productionFlags() {
  process.env.NODE_ENV = "production";
  delete process.env.E2E;
  delete process.env.PLAYWRIGHT_TEST_MODE;
  delete process.env.NEXT_PUBLIC_TEST_MODE;
}

describe("arePaymentsLive", () => {
  afterEach(resetEnv);

  it("opens under the local/dev override without PayRam", () => {
    productionFlags();
    process.env.NODE_ENV = "development";
    delete process.env.NEXT_PUBLIC_CRYPTO_TOPUP_ENABLED;
    delete process.env.PAYRAM_ENABLED;
    expect(arePaymentsLive()).toBe(true);
  });

  it("stays closed in production when only the public flag is on", () => {
    productionFlags();
    process.env.NEXT_PUBLIC_CRYPTO_TOPUP_ENABLED = "true";
    delete process.env.PAYRAM_ENABLED;
    delete process.env.PAYRAM_API_KEY;
    delete process.env.PAYRAM_BASE_URL;
    expect(isPayramConfigured()).toBe(false);
    expect(arePaymentsLive()).toBe(false);
    expect(isPayramCheckoutOpen()).toBe(false);
  });

  it("stays closed in production when only PayRam is configured", () => {
    productionFlags();
    process.env.NEXT_PUBLIC_CRYPTO_TOPUP_ENABLED = "false";
    process.env.PAYRAM_ENABLED = "true";
    process.env.PAYRAM_API_KEY = "key";
    process.env.PAYRAM_BASE_URL = "https://pay.example.com";
    expect(isPayramConfigured()).toBe(true);
    expect(arePaymentsLive()).toBe(false);
    expect(isPayramCheckoutOpen()).toBe(false);
  });

  it("opens in production only when both flags are on", () => {
    productionFlags();
    process.env.NEXT_PUBLIC_CRYPTO_TOPUP_ENABLED = "true";
    process.env.PAYRAM_ENABLED = "true";
    process.env.PAYRAM_API_KEY = "key";
    process.env.PAYRAM_BASE_URL = "https://pay.example.com";
    expect(arePaymentsLive()).toBe(true);
    expect(isPayramCheckoutOpen()).toBe(true);
  });

  it("refuses a split production config at boot", () => {
    productionFlags();
    process.env.NEXT_PUBLIC_CRYPTO_TOPUP_ENABLED = "true";
    delete process.env.PAYRAM_ENABLED;
    expect(unpairedPaymentFlagsError()).toMatch(/PAYRAM_ENABLED/);
  });
});
