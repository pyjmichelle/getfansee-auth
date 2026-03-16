import { test, expect } from "@playwright/test";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";

test.describe("auth-mock: auth page basics", () => {
  test("mode=signup shows signup tab active", async ({ page }) => {
    await page.goto(`${BASE_URL}/auth?mode=signup`);
    await expect(page.getByTestId("auth-tab-signup")).toHaveAttribute("data-state", "active");
    await expect(page.getByTestId("auth-submit")).toBeDisabled();
  });

  test("mode=login shows login tab active", async ({ page }) => {
    await page.goto(`${BASE_URL}/auth?mode=login`);
    await expect(page.getByTestId("auth-tab-login")).toHaveAttribute("data-state", "active");
    await expect(page.getByTestId("auth-submit")).toBeEnabled();
  });
});
