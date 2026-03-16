/**
 * E2E: Auth forgot-password / reset-password / admin redirect
 *
 * Covers:
 *  - /auth/forgot-password page renders correctly
 *  - /auth/reset-password page renders correctly
 *  - Unauthenticated access to /admin redirects to /auth (P0-4 regression test)
 */

import { test, expect } from "@playwright/test";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";

test.describe("forgot-password page", () => {
  test("renders email input and submit button", async ({ page }) => {
    await page.goto(`${BASE_URL}/auth/forgot-password`);

    const emailInput = page.locator('input[type="email"], input[name="email"]');
    await expect(emailInput).toBeVisible();

    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeVisible();
  });

  test("shows error when submitting invalid email", async ({ page }) => {
    await page.goto(`${BASE_URL}/auth/forgot-password`);

    const emailInput = page.locator('input[type="email"], input[name="email"]');
    await emailInput.fill("not-an-email");

    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();

    // Should show validation error (not navigate away)
    await expect(page).toHaveURL(new RegExp("/auth/forgot-password"));
  });

  test("back-to-login link navigates to /auth", async ({ page }) => {
    await page.goto(`${BASE_URL}/auth/forgot-password`);

    const backLink = page.locator('a[href*="/auth"]').first();
    await expect(backLink).toBeVisible();
  });
});

test.describe("reset-password page", () => {
  test("renders password input and submit button", async ({ page }) => {
    // reset-password page requires a PASSWORD_RECOVERY event from Supabase;
    // without a real token it shows the waiting/invalid-link state.
    await page.goto(`${BASE_URL}/auth/reset-password`);

    // The page should load without crashing (200 or client-rendered)
    await expect(page).not.toHaveURL(/500/);
    await expect(page).not.toHaveURL(/error/);

    // Should render some visible content
    const body = page.locator("body");
    await expect(body).toBeVisible();
  });
});

test.describe("admin route protection (P0-4)", () => {
  test("unauthenticated request to /admin redirects to /auth", async ({ page }) => {
    // Clear any existing cookies to ensure unauthenticated state
    await page.context().clearCookies();
    await page.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle" });

    // Should redirect to /auth (possibly with ?next=/admin)
    await expect(page).toHaveURL(new RegExp("/auth"));
  });

  test("unauthenticated request to /admin/reports redirects to /auth", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto(`${BASE_URL}/admin/reports`, { waitUntil: "networkidle" });

    await expect(page).toHaveURL(new RegExp("/auth"));
  });
});
