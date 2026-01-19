import { test, expect } from "@playwright/test";

test.describe("System Health Check", () => {
  test("homepage returns 200 and has no console errors", async ({ page }) => {
    const consoleErrors: string[] = [];

    // Listen for console errors
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    // Navigate to homepage
    const response = await page.goto("/");

    // Verify HTTP 200
    expect(response?.status()).toBe(200);

    // Wait for page to be fully loaded
    await page.waitForLoadState("networkidle");

    // Check for console errors (filter out known non-critical errors)
    const criticalErrors = consoleErrors.filter(
      (error) =>
        !error.includes("favicon") && !error.includes("manifest") && !error.includes("third-party")
    );

    // Report any errors found
    if (criticalErrors.length > 0) {
      console.log("Console errors found:", criticalErrors);
    }

    expect(criticalErrors).toHaveLength(0);
  });

  test("auth page returns 200", async ({ page }) => {
    const response = await page.goto("/auth");
    expect(response?.status()).toBe(200);
    await page.waitForLoadState("networkidle");
  });
});
