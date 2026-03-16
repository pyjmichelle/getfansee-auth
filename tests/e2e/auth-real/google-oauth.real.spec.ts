import { test, expect } from "@playwright/test";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";

const GOOGLE_EMAIL = process.env.E2E_GOOGLE_EMAIL;
const GOOGLE_PASSWORD = process.env.E2E_GOOGLE_PASSWORD;

test.describe("auth-real: google oauth", () => {
  test.skip(
    process.env.AUTH_E2E_REAL_OAUTH !== "1",
    "Set AUTH_E2E_REAL_OAUTH=1 to run real OAuth tests."
  );

  test.skip(!GOOGLE_EMAIL || !GOOGLE_PASSWORD, "Missing E2E_GOOGLE_EMAIL / E2E_GOOGLE_PASSWORD");

  test("google login redirects back and lands on /home", async ({ page }) => {
    await page.goto(`${BASE_URL}/auth?mode=login`, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("auth-google-button-login")).toBeVisible({ timeout: 20_000 });

    await page.getByTestId("auth-google-button-login").click();

    await expect
      .poll(async () => page.url(), { timeout: 60_000, intervals: [1000, 2000, 3000] })
      .toContain("accounts.google.com");

    // Step A: account chooser (if exists)
    const accountByEmail = page.getByText(GOOGLE_EMAIL!, { exact: false });
    if (
      await accountByEmail
        .first()
        .isVisible()
        .catch(() => false)
    ) {
      await accountByEmail.first().click();
    }

    // Step B: email input page (if exists)
    const emailInput = page.locator('input[type="email"]').first();
    if (await emailInput.isVisible().catch(() => false)) {
      await emailInput.fill(GOOGLE_EMAIL!);
      await page.getByRole("button", { name: /next/i }).click();
    }

    // Step C: password input
    const passwordInput = page.locator('input[type="password"]').first();
    await expect(passwordInput).toBeVisible({ timeout: 45_000 });
    await passwordInput.fill(GOOGLE_PASSWORD!);
    await page.getByRole("button", { name: /next/i }).click();

    // Step D: optional consent
    const continueButton = page.getByRole("button", { name: /continue|allow|accept/i }).first();
    if (await continueButton.isVisible().catch(() => false)) {
      await continueButton.click();
    }

    // 回站后会先落到 /auth/verify，再进入 /home
    await expect
      .poll(async () => page.url(), { timeout: 90_000, intervals: [1000, 2000, 3000] })
      .toMatch(/\/(auth\/verify|home)/);

    await expect
      .poll(async () => page.url(), { timeout: 90_000, intervals: [1000, 2000, 3000] })
      .toContain("/home");

    await expect(page.getByTestId("home-feed")).toBeVisible({ timeout: 30_000 });
  });
});
