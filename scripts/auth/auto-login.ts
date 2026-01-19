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

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:3000";
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

    // Navigate to auth page
    console.log(`\n→ Opening ${BASE_URL}/auth`);
    await page.goto(`${BASE_URL}/auth`, {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });

    console.log("\n🔑 Attempting automated login...");

    // Wait for auth page to load
    await page.waitForTimeout(2000);

    // Ensure we're on the login tab (not signup)
    console.log("   → Ensuring login tab is active...");
    try {
      const loginTab = page
        .locator('button[role="tab"]:has-text("Login"), button:has-text("Login")')
        .first();
      await loginTab.click();
      await page.waitForTimeout(500);
    } catch (e) {
      console.log("   → Login tab already active or not found");
    }

    // Fill in credentials using specific IDs
    console.log("   → Filling email...");
    const emailInput = page.locator("#login-email");
    await emailInput.waitFor({ state: "visible", timeout: 10000 });
    await emailInput.fill(account.email);

    console.log("   → Filling password...");
    const passwordInput = page.locator("#login-password");
    await passwordInput.waitFor({ state: "visible", timeout: 10000 });
    await passwordInput.fill(account.password);

    await page.waitForTimeout(500);

    // Submit the form
    console.log("   → Submitting login form...");
    const submitButton = page.locator('button[type="submit"]:has-text("Sign In")').first();
    await submitButton.click();

    // Wait for the button to show "Signing in..." (loading state)
    console.log("   → Waiting for form submission...");
    await page.waitForTimeout(1000);

    // Wait for navigation or error (up to 15 seconds)
    console.log("   → Waiting for login response...");
    await Promise.race([
      page.waitForURL((url) => !url.toString().includes("/auth"), { timeout: 15000 }),
      page.waitForTimeout(15000),
    ]);

    // Check if login was successful
    const currentUrl = page.url();
    console.log(`   → Current URL: ${currentUrl}`);

    // Check for error messages on the page
    const errorAlert = await page
      .locator('[role="alert"], .alert-destructive, [class*="error"]')
      .first()
      .textContent()
      .catch(() => null);
    if (errorAlert) {
      console.error(`   ⚠️  Error message on page: ${errorAlert}`);
    }

    if (currentUrl.includes("/auth")) {
      console.error("\n❌ Login failed - still on auth page");
      console.error(`   URL: ${currentUrl}`);

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
