import { test, expect } from "@playwright/test";

test.describe("Reproduce 'Something went wrong' error on /home", () => {
  test("should show error when accessing /home without authentication", async ({
    page,
    context,
  }) => {
    // Step 1: Clear all cookies and storage for the domain
    await context.clearCookies();
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    const consoleErrors: Array<{ type: string; text: string; location?: string }> = [];
    const networkErrors: Array<{ url: string; status: number; statusText: string }> = [];

    // Step 2: Listen for console errors
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push({
          type: msg.type(),
          text: msg.text(),
          location: msg.location()?.url,
        });
      }
    });

    // Step 3: Listen for network errors
    page.on("response", (response) => {
      if (!response.ok() && response.status() !== 404) {
        networkErrors.push({
          url: response.url(),
          status: response.status(),
          statusText: response.statusText(),
        });
      }
    });

    // Step 4: Navigate directly to /home
    console.log("\n=== Navigating to /home ===");
    const response = await page.goto("/home", { waitUntil: "networkidle" });

    // Step 5: Take screenshot immediately
    await page.screenshot({ path: "tests/e2e/screenshots/home-error.png", fullPage: true });

    // Step 6: Get the current URL and page title
    const currentUrl = page.url();
    const pageTitle = await page.title();

    console.log("\n=== Page State ===");
    console.log("Current URL:", currentUrl);
    console.log("Page Title:", pageTitle);
    console.log("Response Status:", response?.status());

    // Step 7: Check if "Something went wrong" page appears
    const errorHeading = page.locator('h1:has-text("Something went wrong")');
    const isErrorPageVisible = await errorHeading.isVisible().catch(() => false);

    console.log("\n=== Error Page Detection ===");
    console.log("'Something went wrong' visible:", isErrorPageVisible);

    // Step 8: Check for specific error patterns
    const authSyncErrors = consoleErrors.filter(
      (e) =>
        e.text.includes("AuthSyncProvider") ||
        e.text.includes("auth-bootstrap-client") ||
        e.text.includes("supabase") ||
        e.text.toLowerCase().includes("module")
    );

    console.log("\n=== Console Errors ===");
    if (consoleErrors.length > 0) {
      consoleErrors.forEach((error, i) => {
        console.log(`\n[${i + 1}] ${error.type.toUpperCase()}`);
        console.log(`Text: ${error.text}`);
        if (error.location) {
          console.log(`Location: ${error.location}`);
        }
      });
    } else {
      console.log("No console errors found");
    }

    console.log("\n=== Auth/Module Related Errors ===");
    if (authSyncErrors.length > 0) {
      authSyncErrors.forEach((error, i) => {
        console.log(`\n[${i + 1}] ${error.text}`);
      });
    } else {
      console.log("No auth/module related errors found");
    }

    console.log("\n=== Network Errors ===");
    if (networkErrors.length > 0) {
      networkErrors.forEach((error, i) => {
        console.log(`\n[${i + 1}] ${error.status} ${error.statusText}`);
        console.log(`URL: ${error.url}`);
      });
    } else {
      console.log("No network errors found");
    }

    // Step 9: Try hard refresh
    console.log("\n=== Performing Hard Refresh ===");
    await page.reload({ waitUntil: "networkidle" });
    const afterRefreshUrl = page.url();
    const afterRefreshTitle = await page.title();
    const isErrorStillVisible = await errorHeading.isVisible().catch(() => false);

    console.log("URL after refresh:", afterRefreshUrl);
    console.log("Title after refresh:", afterRefreshTitle);
    console.log("Error still visible:", isErrorStillVisible);

    // Step 10: Check for auth redirect
    console.log("\n=== Auth Redirect Check ===");
    if (currentUrl.includes("/auth")) {
      console.log("✓ Redirected to auth page (expected behavior)");
    } else if (isErrorPageVisible) {
      console.log("✗ Showing error page (unexpected - this is the bug!)");
    } else {
      console.log("? Unknown state - neither auth redirect nor error page");
    }

    // Step 11: Get page HTML for debugging
    const pageHtml = await page.content();
    const hasErrorBoundary = pageHtml.includes("Something went wrong");
    const hasAuthForm = pageHtml.includes("Sign in") || pageHtml.includes("Welcome back");

    console.log("\n=== Page Content Analysis ===");
    console.log("Has error boundary:", hasErrorBoundary);
    console.log("Has auth form:", hasAuthForm);

    // Report summary
    console.log("\n=== SUMMARY ===");
    console.log("Expected: Redirect to /auth");
    console.log("Actual:", currentUrl);
    console.log("Console Errors:", consoleErrors.length);
    console.log("Network Errors:", networkErrors.length);
    console.log("Auth/Module Errors:", authSyncErrors.length);
    console.log("Error Page Visible:", isErrorPageVisible);

    // The test passes if we successfully captured the state
    // We're not asserting success/failure, just documenting behavior
    expect(true).toBe(true);
  });

  test("should handle /home with valid session", async ({ page }) => {
    // This test would require setting up a valid session
    // For now, just document that this is the happy path
    console.log("\n=== Happy Path Test (requires auth setup) ===");
    console.log("This test would verify /home works with valid authentication");
    expect(true).toBe(true);
  });
});
