#!/usr/bin/env tsx
/**
 * Auto Login - Automated Session Export
 *
 * Automatically logs in using test credentials and exports storageState.
 * Usage: ROLE=fan tsx scripts/auth/auto-login.ts
 */

import { chromium, Browser, BrowserContext, Page } from "playwright";
import * as fs from "fs";
import * as path from "path";
import { getBaseUrl } from "../_shared/env";

// Load .env.local for environment variables (Supabase URLs, etc)
const envLocalPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envLocalPath)) {
  const envContent = fs.readFileSync(envLocalPath, "utf-8");
  envContent.split("\n").forEach((line) => {
    line = line.trim();
    if (line && !line.startsWith("#")) {
      const [key, ...valueParts] = line.split("=");
      const value = valueParts.join("=").trim();
      if (key && value && !process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

const BASE_URL = getBaseUrl();
const ROLE = process.env.ROLE || "fan";
const HEADED = process.env.HEADED === "true";
const SESSIONS_DIR = path.join(process.cwd(), "artifacts", "agent-browser-full", "sessions");

const TEST_ACCOUNTS = {
  fan: {
    email: "test-fan@example.com",
    password: "TestPassword123!",
    userId: "dec562f2-a534-42a0-91f7-a5b8dbcf9305",
    testPage: "/home",
    name: "Fan",
  },
  creator: {
    email: "test-creator@example.com",
    password: "TestPassword123!",
    userId: "77deaaa3-0c60-417d-ac8d-152ec291f674",
    testPage: "/creator/studio",
    name: "Creator",
  },
};

function ensureSessionsDir() {
  if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
  }
}

async function autoLogin(role: "fan" | "creator") {
  const account = TEST_ACCOUNTS[role];

  console.log("🔐 Automated Login Session Export");
  console.log("=".repeat(60));
  console.log(`Role: ${account.name}`);
  console.log(`Email: ${account.email}`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Test Page: ${account.testPage}`);
  console.log("=".repeat(60));

  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let page: Page | null = null;

  try {
    // Launch browser
    console.log(`\n🌐 Launching browser (${HEADED ? "headed" : "headless"})...`);
    browser = await chromium.launch({
      headless: !HEADED,
      slowMo: HEADED ? 500 : 0,
    });

    context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      baseURL: BASE_URL,
    });

    page = await context.newPage();

    // Capture console errors for debugging
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
        console.log(`   [Browser Error] ${msg.text()}`);
      }
      if (msg.type() === "warning") {
        console.log(`   [Browser Warn] ${msg.text()}`);
      }
    });
    page.on("pageerror", (error) => {
      consoleErrors.push(error.message);
      console.log(`   [Page Error] ${error.message}`);
    });
    page.on("requestfailed", (request) => {
      const url = request.url();
      if (url.includes("/auth/v1/") || url.includes("supabase")) {
        console.warn(`   [Request Failed] ${request.method()} ${url}`);
        console.warn(`   → ${request.failure()?.errorText || "unknown error"}`);
      }
    });
    page.on("response", (response) => {
      const url = response.url();
      if (url.includes("/auth/v1/token")) {
        console.log(`   [Auth Response] ${response.status()} ${url}`);
      }
    });
    page.on("request", (request) => {
      const url = request.url();
      if (url.includes("/auth/v1/") || url.includes("supabase")) {
        console.log(`   [Auth Request] ${request.method()} ${url}`);
      }
    });

    // Navigate to auth page
    console.log(`\n→ Opening ${BASE_URL}/auth`);
    await page.goto(`${BASE_URL}/auth`, {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });

    console.log("\n🔑 Attempting automated login...");

    // #region agent log
    fetch("http://127.0.0.1:7243/ingest/68e3b8f5-5423-4da0-8d81-7693c6fde45d", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "auto-login.ts:START",
        message: "开始登录",
        data: { url: page.url(), role: ROLE },
        timestamp: Date.now(),
        sessionId: "debug-session",
        hypothesisId: "START",
      }),
    }).catch(() => {});
    // #endregion

    // Check for age gate first
    console.log("   → Checking for age gate...");
    await page.waitForTimeout(1000);
    const ageGateModal = page.locator('[data-testid="age-gate-modal"], [data-testid="agegate"]');
    const hasAgeGate = await ageGateModal
      .first()
      .isVisible()
      .catch(() => false);
    if (hasAgeGate) {
      console.log("   → Age gate detected, accepting...");
      await page
        .locator('[data-testid="age-gate-yes"], [data-testid="agegate-continue"]')
        .first()
        .click();
      await page.waitForTimeout(1500);
      // #region agent log
      fetch("http://127.0.0.1:7243/ingest/68e3b8f5-5423-4da0-8d81-7693c6fde45d", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location: "auto-login.ts:AGE_GATE",
          message: "Age gate accepted",
          data: { hadAgeGate: true },
          timestamp: Date.now(),
          sessionId: "debug-session",
          hypothesisId: "A",
        }),
      }).catch(() => {});
      // #endregion
    } else {
      console.log("   → No age gate present");
    }

    // Wait for auth page to fully load
    await page.waitForTimeout(1000);

    // Ensure we're on the login tab (not signup) using testid
    console.log("   → Ensuring login tab is active...");
    try {
      const loginTab = page.getByTestId("auth-tab-login");
      const isVisible = await loginTab.isVisible().catch(() => false);
      if (isVisible) {
        await loginTab.click();
        await page.waitForTimeout(500);
        console.log("   → Clicked login tab");
        // #region agent log
        fetch("http://127.0.0.1:7243/ingest/68e3b8f5-5423-4da0-8d81-7693c6fde45d", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "auto-login.ts:TAB",
            message: "Login tab clicked",
            data: {},
            timestamp: Date.now(),
            sessionId: "debug-session",
            hypothesisId: "D",
          }),
        }).catch(() => {});
        // #endregion
      } else {
        console.log("   → Login tab not visible");
      }
    } catch (e) {
      console.log("   → Login tab error:", e);
    }

    // Fill in credentials using specific IDs
    console.log("   → Filling email...");
    const emailInput = page.getByTestId("auth-email");
    await emailInput.waitFor({ state: "visible", timeout: 10000 });
    await emailInput.fill(account.email);
    // #region agent log
    fetch("http://127.0.0.1:7243/ingest/68e3b8f5-5423-4da0-8d81-7693c6fde45d", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "auto-login.ts:EMAIL",
        message: "Email filled",
        data: { email: account.email },
        timestamp: Date.now(),
        sessionId: "debug-session",
        hypothesisId: "B",
      }),
    }).catch(() => {});
    // #endregion

    console.log("   → Filling password...");
    const passwordInput = page.getByTestId("auth-password");
    await passwordInput.waitFor({ state: "visible", timeout: 10000 });
    await passwordInput.fill(account.password);
    // #region agent log
    fetch("http://127.0.0.1:7243/ingest/68e3b8f5-5423-4da0-8d81-7693c6fde45d", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "auto-login.ts:PASSWORD",
        message: "Password filled",
        data: { passwordLength: account.password.length },
        timestamp: Date.now(),
        sessionId: "debug-session",
        hypothesisId: "B",
      }),
    }).catch(() => {});
    // #endregion

    await page.waitForTimeout(500);

    // Submit the form
    console.log("   → Submitting login form...");
    const submitButton = page.getByTestId("auth-submit");
    await submitButton.click();
    // #region agent log
    fetch("http://127.0.0.1:7243/ingest/68e3b8f5-5423-4da0-8d81-7693c6fde45d", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "auto-login.ts:SUBMIT",
        message: "Submit clicked",
        data: {},
        timestamp: Date.now(),
        sessionId: "debug-session",
        hypothesisId: "B",
      }),
    }).catch(() => {});
    // #endregion

    console.log("   → Waiting for login response...");

    let authTokenStatus: number | null = null;
    try {
      const authResponse = await page.waitForResponse(
        (response) => response.url().includes("/auth/v1/token"),
        { timeout: 30000 }
      );
      authTokenStatus = authResponse.status();
      console.log(`   [Auth Token Response] ${authTokenStatus}`);
    } catch {
      console.warn("   [Auth Token Response] timeout waiting for /auth/v1/token");
      // In CI, give more time for network delays
      if (process.env.CI === "true") {
        console.warn("   [CI Mode] Waiting additional 5s for network stabilization...");
        await page.waitForTimeout(5000);
      }
    }

    const errorAlert = page.locator('[role="alert"], .alert-destructive').first();
    let loginOutcome: "navigated" | "error" | "timeout" = "timeout";
    // In CI, give more time for navigation
    const navigationTimeout = process.env.CI === "true" ? 45000 : 30000;
    try {
      await page.waitForURL((url) => !url.toString().includes("/auth"), {
        timeout: navigationTimeout,
      });
      loginOutcome = "navigated";
    } catch {
      loginOutcome = "timeout";
      // In CI, wait a bit more and check again
      if (process.env.CI === "true") {
        console.warn("   [CI Mode] Initial navigation timeout, waiting 3s and rechecking...");
        await page.waitForTimeout(3000);
        const currentUrl = page.url();
        if (!currentUrl.includes("/auth")) {
          loginOutcome = "navigated";
          console.log(`   [CI Mode] Navigation succeeded after retry: ${currentUrl}`);
        }
      }
    }

    // Check current state after submission
    const urlAfterSubmit = page.url();
    const bodyText = await page.textContent("body").catch(() => "");
    // #region agent log
    fetch("http://127.0.0.1:7243/ingest/68e3b8f5-5423-4da0-8d81-7693c6fde45d", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "auto-login.ts:AFTER_SUBMIT",
        message: "After submit state",
        data: {
          url: urlAfterSubmit,
          hasError: bodyText.includes("error") || bodyText.includes("Error"),
          hasInvalid: bodyText.includes("Invalid") || bodyText.includes("incorrect"),
        },
        timestamp: Date.now(),
        sessionId: "debug-session",
        hypothesisId: "C",
      }),
    }).catch(() => {});
    // #endregion

    const currentUrl = page.url();
    console.log(`   → Current URL: ${currentUrl}`);

    const errorAlertText = await errorAlert.textContent().catch(() => null);
    if (errorAlertText) {
      console.error(`   ⚠️  Error message on page: ${errorAlertText}`);
      loginOutcome = "error";
    }

    if (currentUrl.includes("/auth")) {
      console.error("\n❌ Login failed - still on auth page");
      console.error(`   URL: ${currentUrl}`);
      console.error(`   Outcome: ${loginOutcome}`);
      if (authTokenStatus !== null) {
        console.error(`   Auth token status: ${authTokenStatus}`);
      }
      const cookies = await context.cookies();
      const cookieNames = cookies.map((cookie) => cookie.name);
      console.error(`   Cookies: ${cookieNames.join(", ") || "none"}`);
      const storageKeys = await page.evaluate(() => Object.keys(localStorage || {}));
      console.error(`   LocalStorage keys: ${storageKeys.join(", ") || "none"}`);

      // Output console errors
      if (consoleErrors.length > 0) {
        console.error(`\n   🔴 Browser Console Errors (${consoleErrors.length}):`);
        consoleErrors.forEach((err, i) => {
          console.error(`      ${i + 1}. ${err}`);
        });
      }

      // Get any visible error messages
      const pageText = await page.textContent("body");
      const errorMatch = pageText?.match(/(Invalid|Error|Failed|incorrect|wrong)[^.!?]*[.!?]/i);
      if (errorMatch) {
        console.error(`   Error hint: ${errorMatch[0]}`);
      }

      // Take screenshot for debugging
      const errorScreenshot = path.join(SESSIONS_DIR, `${role}-login-failed.png`);
      await page.screenshot({ path: errorScreenshot, fullPage: true });
      console.error(`   Screenshot: ${errorScreenshot}`);

      // In CI, provide more context
      if (process.env.CI === "true") {
        console.error(`\n   🔍 CI Environment Debug Info:`);
        console.error(`   - BASE_URL: ${BASE_URL}`);
        console.error(
          `   - NEXT_PUBLIC_SUPABASE_URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL ? "set" : "not set"}`
        );
        console.error(
          `   - NEXT_PUBLIC_SUPABASE_ANON_KEY: ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "set" : "not set"}`
        );
        console.error(`   - Test account email: ${account.email}`);
        console.error(`   - This may indicate:`);
        console.error(`     1. Network connectivity issues with Supabase`);
        console.error(`     2. Test account credentials are incorrect`);
        console.error(`     3. Test account does not exist in database`);
        console.error(`     4. Server is not responding correctly`);
      }

      process.exit(1);
    }

    console.log("   ✓ Login successful!");

    // Wait for session to stabilize and verify via API
    console.log("\n⏳ Waiting for session to stabilize...");
    await page.waitForTimeout(2000);

    // Verify login by checking /api/profile endpoint
    console.log("\n🔍 Verifying session via /api/profile...");
    let profileVerified = false;
    for (let i = 0; i < 10; i++) {
      try {
        const response = await page.goto(`${BASE_URL}/api/profile`, {
          waitUntil: "domcontentloaded",
          timeout: 10000,
        });
        if (response && response.status() === 200) {
          const body = await response.text();
          console.log(`   ✓ Profile API returned 200`);
          console.log(`   → User ID: ${account.userId}`);
          profileVerified = true;
          break;
        }
      } catch (e) {
        // Retry
      }
      await page.waitForTimeout(1000);
    }

    if (!profileVerified) {
      console.warn("   ⚠️  Profile API verification failed, continuing anyway...");
    }

    // Navigate to role-specific test page
    console.log(`\n🔍 Verifying access to ${account.testPage}...`);
    await page.goto(`${BASE_URL}${account.testPage}`, {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });

    await page.waitForTimeout(3000);

    const finalUrl = page.url();
    console.log(`   Final URL: ${finalUrl}`);

    // Check if we got redirected back to auth
    if (finalUrl.includes("/auth")) {
      console.error("\n❌ Verification failed: Redirected back to /auth");
      console.error("   This means the session is not valid for this role");

      // Take screenshot for debugging
      const errorScreenshot = path.join(SESSIONS_DIR, `${role}-verification-failed.png`);
      await page.screenshot({ path: errorScreenshot, fullPage: true });
      console.error(`   Screenshot saved: ${errorScreenshot}`);

      // In CI, provide more context
      if (process.env.CI === "true") {
        console.error(`\n   🔍 CI Environment Debug Info:`);
        console.error(`   - Expected page: ${account.testPage}`);
        console.error(`   - Actual URL: ${finalUrl}`);
        console.error(`   - This may indicate:`);
        console.error(`     1. Session cookies are invalid`);
        console.error(`     2. User profile is missing or incorrect role`);
        console.error(`     3. Middleware is redirecting due to auth check failure`);
      }

      process.exit(1);
    }

    console.log("   ✓ Verification passed!");

    // Export storage state
    const sessionPath = path.join(SESSIONS_DIR, `${role}.json`);
    console.log(`\n💾 Exporting session to: ${sessionPath}`);

    await context.storageState({ path: sessionPath });
    console.log("   ✓ Session exported");

    // Take verification screenshot
    const screenshotPath = path.join(SESSIONS_DIR, `${role}-post-login.png`);
    console.log(`\n📸 Taking verification screenshot: ${screenshotPath}`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log("   ✓ Screenshot saved");

    // Show session info (without sensitive data)
    const sessionData = JSON.parse(fs.readFileSync(sessionPath, "utf-8"));
    const cookieCount = sessionData.cookies?.length || 0;
    const originCount = sessionData.origins?.length || 0;

    console.log("\n📊 Session Info:");
    console.log(`   Cookies: ${cookieCount}`);
    console.log(`   Origins: ${originCount}`);
    console.log(`   Final URL: ${finalUrl}`);

    console.log("\n" + "=".repeat(60));
    console.log("✅ SUCCESS");
    console.log("=".repeat(60));
    console.log(`Session file: ${sessionPath}`);
    console.log(`Screenshot: ${screenshotPath}`);
  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}`);

    if (page) {
      try {
        const errorScreenshot = path.join(SESSIONS_DIR, `${role}-error.png`);
        await page.screenshot({ path: errorScreenshot, fullPage: true });
        console.error(`Error screenshot: ${errorScreenshot}`);
      } catch (e) {
        // Ignore
      }
    }

    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
      console.log("\n🔒 Browser closed");
    }
  }
}

// Main
async function main() {
  ensureSessionsDir();

  if (!["fan", "creator"].includes(ROLE)) {
    console.error(`❌ Invalid ROLE: ${ROLE}`);
    console.error(`   Must be: fan or creator`);
    console.error(`   Usage: ROLE=fan tsx scripts/auth/auto-login.ts`);
    process.exit(1);
  }

  await autoLogin(ROLE as "fan" | "creator");
}

main();
