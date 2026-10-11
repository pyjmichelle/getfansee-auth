import { afterEach, describe, expect, it, vi } from "vitest";
import { isExplicitTestEnvironment, isLocalDevelopmentOrTest } from "@/lib/test-environment";
import { getRequestGeo } from "@/lib/compliance/request-geo";
import { canAccessTestRoute } from "@/lib/test-route-guard";
import { NextRequest } from "next/server";
import {
  assertDedicatedTestProject,
  assertLocalTestTarget,
} from "@/scripts/utils/assert-test-environment";

afterEach(() => vi.unstubAllEnvs());
describe("test environment containment", () => {
  it.each(["VERCEL_ENV", "APP_ENV"])("%s production refuses runtime overrides", (name) => {
    vi.stubEnv(name, "production");
    vi.stubEnv("E2E", "1");
    vi.stubEnv("PLAYWRIGHT_TEST_MODE", "true");
    vi.stubEnv("NODE_ENV", "development");
    expect(isExplicitTestEnvironment()).toBe(false);
    expect(isLocalDevelopmentOrTest()).toBe(false);
    const headers = new Headers({ "x-gfs-test-country": "US" });
    expect(getRequestGeo(headers).country).not.toBe("US");
    expect(
      canAccessTestRoute(
        new NextRequest("http://localhost/api/test/ping", { headers: { host: "localhost" } })
      )
    ).toBe(false);
  });
  it("does not trust forwarded host to grant test access", () => {
    vi.stubEnv("E2E", "1");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("APP_ENV", "test");
    vi.stubEnv("E2E_ALLOW_ANY_HOST", "false");
    expect(
      canAccessTestRoute(
        new NextRequest("https://example.com/api/test/ping", {
          headers: { host: "example.com", "x-forwarded-host": "localhost" },
        })
      )
    ).toBe(false);
  });
  it("requires both declared test project and distinct known production project", () => {
    const env = { E2E_SUPABASE_PROJECT_REF: "test", PRODUCTION_SUPABASE_PROJECT_REF: "prod" };
    expect(() => assertDedicatedTestProject("https://test.supabase.co", env)).not.toThrow();
    for (const url of [
      "https://prod.supabase.co",
      "http://test.supabase.co",
      "https://test.supabase.co.evil.com",
      "https://test.supabase.co/path",
      "https://user@test.supabase.co",
    ]) {
      expect(() => assertDedicatedTestProject(url, env)).toThrow();
    }
    expect(() =>
      assertDedicatedTestProject("https://test.supabase.co", {
        ...env,
        PRODUCTION_SUPABASE_PROJECT_REF: "test",
      })
    ).toThrow();
    expect(() =>
      assertDedicatedTestProject("https://test.supabase.co", { E2E_SUPABASE_PROJECT_REF: "test" })
    ).toThrow();
  });
  it("refuses non-loopback test API targets", () => {
    expect(() => assertLocalTestTarget("http://127.0.0.1:3000")).not.toThrow();
    expect(() => assertLocalTestTarget("https://getfansee.com")).toThrow();
  });
});
