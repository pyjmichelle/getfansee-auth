#!/usr/bin/env tsx
/**
 * Export Storage State - Manual Login Helper
 *
 * Opens a headed browser for manual login, then exports storageState.
 * Usage: ROLE=fan tsx scripts/auth/export-storage-state.ts
 */

import { chromium, Browser, BrowserContext, Page } from "playwright";
import * as fs from "fs";
import * as path from "path";

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:3000";
const ROLE = process.env.ROLE || "fan";
const SESSIONS_DIR = path.join(process.cwd(), "artifacts", "agent-browser-full", "sessions");

const ROLE_CONFIG = {
  fan: {
    name: "Fan",
    testPage: "/home",
    description: "Regular fan user",
  },
  creator: {
    name: "Creator",
    testPage: "/creator/studio",
    description: "Content creator",
  },
};

function ensureSessionsDir() {
  if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
  }
}

async function exportStorageState(role: "fan" | "creator") {
  console.log("🔐 Manual Login Session Export");
  console.log("=".repeat(60));
  console.log(`Role: ${ROLE_CONFIG[role].name}`);
  console.log(`Description: ${ROLE_CONFIG[role].description}`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Test Page: ${ROLE_CONFIG[role].testPage}`);
  console.log("=".repeat(60));
  console.log("");
  console.log("📋 INSTRUCTIONS:");
  console.log("1. Browser will open to /auth");
  console.log("2. Manually login with your credentials");
  console.log("3. Wait for redirect to home/feed");
  console.log("4. Script will auto-detect login and export session");
  console.log("5. Browser will close automatically");
  console.log("");
  console.log("⏳ Opening browser in 3 seconds...");

  await new Promise((resolve) => setTimeout(resolve, 3000));

  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let page: Page | null = null;

  try {
    // Launch headed browser
    console.log("\n🌐 Launching browser (headed mode)...");
    browser = await chromium.launch({
      headless: false,
      slowMo: 100, // Slow down for visibility
    });

    context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      baseURL: BASE_URL,
    });

    page = await context.newPage();

    // Navigate to auth page
    console.log(`\n→ Opening ${BASE_URL}/auth`);
    await page.goto(`${BASE_URL}/auth`, { waitUntil: "domcontentloaded", timeout: 90000 });

    console.log("\n✋ PLEASE LOGIN NOW");
    console.log("   Waiting for you to complete login...");
    console.log("   (Script will auto-detect when you're logged in)");

    // Wait for navigation away from /auth
    let loginDetected = false;
    let attempts = 0;
    const maxAttempts = 120; // 2 minutes

    while (!loginDetected && attempts < maxAttempts) {
      await page.waitForTimeout(1000);
      attempts++;

      const currentUrl = page.url();

      // Check if we're no longer on /auth
      if (!currentUrl.includes("/auth")) {
        console.log(`\n✓ Login detected! Current URL: ${currentUrl}`);
        loginDetected = true;
        break;
      }

      // Show progress every 10 seconds
      if (attempts % 10 === 0) {
        console.log(`   Still waiting... (${attempts}s elapsed)`);
      }
    }

    if (!loginDetected) {
      console.error("\n❌ Timeout: No login detected after 2 minutes");
      console.error("   Please try again and complete login faster");
      process.exit(1);
    }

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
          console.log("   ✓ Profile API returned 200");
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
    console.log(`\n🔍 Verifying login at ${ROLE_CONFIG[role].testPage}...`);
    await page.goto(`${BASE_URL}${ROLE_CONFIG[role].testPage}`, {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });

    await page.waitForTimeout(3000);

    const finalUrl = page.url();
    console.log(`   Final URL: ${finalUrl}`);

    // Check if we got redirected back to auth
    if (finalUrl.includes("/auth")) {
      console.error("\n❌ Verification failed: Redirected back to /auth");
      console.error("   This means login didn't work properly");
      console.error("   Possible reasons:");
      console.error("   1. Wrong role (fan trying to access creator page)");
      console.error("   2. Session not saved properly");
      console.error("   3. Account doesn't have required permissions");

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
    console.log(`\nYou can now run: pnpm audit:full`);
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
    console.error(`   Usage: ROLE=fan pnpm test:session:export:fan`);
    process.exit(1);
  }

  await exportStorageState(ROLE as "fan" | "creator");
}

main();
