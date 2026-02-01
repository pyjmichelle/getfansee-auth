/**
 * Auth page Design QA: tab active state + checkbox gating.
 * No waitForTimeout; use toBeVisible / toHaveAttribute / toBeDisabled.
 */
import { test, expect } from "@playwright/test";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";

test.describe("Auth page: tabs and 18+ checkbox", () => {
  test("mode=signup: Sign Up tab is active, Login tab is inactive", async ({ page }) => {
    await page.goto(`${BASE_URL}/auth?mode=signup`);
    await expect(page.getByTestId("auth-tab-signup")).toHaveAttribute("data-state", "active");
    await expect(page.getByTestId("auth-tab-login")).toHaveAttribute("data-state", "inactive");
  });

  test("mode=login: Login tab is active, Sign Up tab is inactive", async ({ page }) => {
    await page.goto(`${BASE_URL}/auth?mode=login`);
    await expect(page.getByTestId("auth-tab-login")).toHaveAttribute("data-state", "active");
    await expect(page.getByTestId("auth-tab-signup")).toHaveAttribute("data-state", "inactive");
  });

  test("signup tab: 18+ unchecked -> Create Account disabled, hint visible", async ({ page }) => {
    await page.goto(`${BASE_URL}/auth?mode=signup`);
    await expect(page.getByTestId("auth-tab-signup")).toHaveAttribute("data-state", "active");
    await expect(page.getByTestId("auth-age-checkbox")).toBeVisible();
    await expect(page.getByTestId("auth-submit")).toBeDisabled();
    await expect(page.getByTestId("auth-age-hint")).toBeVisible();
  });

  test("signup tab: check 18+ -> Create Account enabled", async ({ page }) => {
    await page.goto(`${BASE_URL}/auth?mode=signup`);
    await page.getByTestId("auth-age-checkbox").click();
    await expect(page.getByTestId("auth-submit")).toBeEnabled();
  });
});
