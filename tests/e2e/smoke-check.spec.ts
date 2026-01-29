import { test, expect } from "@playwright/test";

test.describe("System Health Check", () => {
  test("homepage returns 200 and has no console errors", async ({ page }) => {
    const consoleErrors: string[] = [];
    const notFoundUrls: string[] = [];

    // Listen for console errors
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });
    page.on("response", (response) => {
      if (response.status() === 404) {
        notFoundUrls.push(response.url());
      }
    });

    // Navigate to homepage
    const response = await page.goto("/");

    // Verify HTTP 200
    expect(response?.status()).toBe(200);

    // Wait for page to be fully loaded
    await page.waitForLoadState("networkidle");

    const isAllowed404 = (url: string) =>
      /\/favicon\.ico$|\/manifest\.json$|\/apple-touch-icon\.png$|\/icon\.(png|svg)$/.test(url);

    const criticalNotFound = notFoundUrls.filter((url) => !isAllowed404(url));
    if (criticalNotFound.length > 0) {
      consoleErrors.push(
        `404 resources: ${criticalNotFound.map((url) => new URL(url).pathname).join(", ")}`
      );
    }

    // Check for console errors (filter out known non-critical errors)
    const criticalErrors = consoleErrors.filter((error) => {
      if (
        error.includes("favicon") ||
        error.includes("manifest") ||
        error.includes("third-party")
      ) {
        return false;
      }
      if (
        error.includes("Failed to load resource: the server responded with a status of 404") &&
        criticalNotFound.length === 0
      ) {
        return false;
      }
      return true;
    });

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
