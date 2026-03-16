/**
 * Email Confirmation E2E (Admin API – UI-independent)
 *
 * Strategy:
 *   1. Create user via Admin API (bypasses UI signup entirely)
 *   2. generateLink() produces a confirmation URL without sending any email
 *   3. Navigate to the URL → /auth/verify handles exchangeCodeForSession → /home
 *
 * This tests the critical /auth/verify callback path without depending on
 * NEXT_PUBLIC_TEST_MODE baked into the running server or Supabase email delivery.
 */
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";
const TEST_PASSWORD = "TestPassword123!";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function generateEmail(): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `e2e-confirm-${ts}-${rand}@example.com`;
}

test.describe("auth-real: email confirmation via admin generateLink", () => {
  test.skip(
    process.env.AUTH_E2E_REAL_OAUTH !== "1",
    "Set AUTH_E2E_REAL_OAUTH=1 to run real auth tests."
  );

  test.skip(!SERVICE_ROLE_KEY, "Missing SUPABASE_SERVICE_ROLE_KEY");

  test("admin createUser + generateLink -> /auth/verify -> /home", async ({ page }) => {
    const email = generateEmail();

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // ── Step 1: Create unconfirmed user via Admin API
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password: TEST_PASSWORD,
      email_confirm: false, // leave unconfirmed so generateLink produces a real token
    });
    if (createErr || !created?.user?.id) {
      throw new Error(`createUser failed: ${createErr?.message ?? "no user returned"}`);
    }

    // ── Step 2: Generate confirmation link (no email sent)
    const { data, error: linkErr } = await admin.auth.admin.generateLink({
      type: "signup",
      email,
      password: TEST_PASSWORD,
      options: { redirectTo: `${BASE_URL}/auth/verify` },
    });
    if (linkErr || !data?.properties?.action_link) {
      throw new Error(`generateLink failed: ${linkErr?.message ?? "no action_link returned"}`);
    }

    const confirmationUrl = data.properties.action_link;

    // ── Step 3: Browser visits the confirmation URL
    // Supabase redirects to /auth/verify?code=... → exchangeCodeForSession → /home
    await page.goto(confirmationUrl, { waitUntil: "domcontentloaded" });

    await expect
      .poll(async () => page.url(), { timeout: 90_000, intervals: [1000, 2000, 3000] })
      .toMatch(/\/(auth\/verify|home)/);

    await expect
      .poll(async () => page.url(), { timeout: 90_000, intervals: [1000, 2000, 3000] })
      .toContain("/home");

    await expect(page.getByTestId("home-feed")).toBeVisible({ timeout: 30_000 });
  });

  test("expired/invalid confirmation link shows error and resend option", async ({ page }) => {
    const fakeVerifyUrl = `${BASE_URL}/auth/verify?error=otp_expired&error_code=otp_expired&error_description=Link+has+expired`;
    await page.goto(fakeVerifyUrl, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: /resend/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: /go to login/i })).toBeVisible({
      timeout: 10_000,
    });
  });
});
