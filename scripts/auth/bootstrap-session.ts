#!/usr/bin/env tsx
/**
 * Bootstrap Authentication Sessions
 *
 * Creates persistent auth sessions for Fan and Creator test accounts.
 * Uses Playwright (agent-browser under the hood) to login and save storageState.
 */

import { chromium, Browser, BrowserContext } from "playwright";
import * as fs from "fs";
import * as path from "path";
import { getBaseUrl } from "../_shared/env";

const BASE_URL = getBaseUrl();
const SESSIONS_DIR = path.join(process.cwd(), "artifacts", "agent-browser-full", "sessions");

// Test accounts from environment or defaults
const TEST_ACCOUNTS = {
  fan: {
    email: process.env.FAN_EMAIL || "fan@test.com",
    password: process.env.FAN_PASSWORD || "TestPassword123!",
    role: "fan" as const,
  },
  creator: {
    email: process.env.CREATOR_EMAIL || "creator@test.com",
    password: process.env.CREATOR_PASSWORD || "TestPassword123!",
    role: "creator" as const,
  },
};

/**
 * Ensure sessions directory exists
 */
function ensureSessionsDir() {
  if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
  }
}

/**
 * Bootstrap a single session using Supabase API
 */
async function bootstrapSession(browser: Browser, role: "fan" | "creator"): Promise<boolean> {
  console.log(`\n🔐 Bootstrapping ${role.toUpperCase()} session...`);

  const account = TEST_ACCOUNTS[role];
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });

  const page = await context.newPage();

  try {
    // Step 1: Navigate to any page to set up context
    console.log(`  → Opening ${BASE_URL}/auth`);
    await page.goto(`${BASE_URL}/auth`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);

    // Step 2: Use Supabase client-side API to login
    console.log(`  → Logging in via Supabase API for ${account.email}`);

    const loginResult = await page.evaluate(
      async ({ email, password }) => {
        try {
          // @ts-ignore - Supabase client should be available
          const { createClient } = await import("@supabase/supabase-js");
          const supabaseUrl =
            (window as any).ENV?.NEXT_PUBLIC_SUPABASE_URL ||
            document.querySelector('meta[name="supabase-url"]')?.getAttribute("content");
          const supabaseKey =
            (window as any).ENV?.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
            document.querySelector('meta[name="supabase-anon-key"]')?.getAttribute("content");

          if (!supabaseUrl || !supabaseKey) {
            // Fallback: use global supabase client if available
            const supabase = (window as any).supabase;
            if (!supabase) {
              return { success: false, error: "Supabase client not available" };
            }

            const { data, error } = await supabase.auth.signInWithPassword({
              email,
              password,
            });

            return { success: !error, error: error?.message, data };
          }

          const supabase = createClient(supabaseUrl, supabaseKey);
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          return { success: !error, error: error?.message, data };
        } catch (err: any) {
          return { success: false, error: err.message };
        }
      },
      { email: account.email, password: account.password }
    );

    if (!loginResult.success) {
      console.error(`  ❌ Login API failed: ${loginResult.error}`);
      console.log(`  → Trying UI-based login as fallback...`);

      // Fallback to UI-based login
      try {
        await page.locator('input[type="email"]').first().fill(account.email);
        await page.locator('input[type="password"]').first().fill(account.password);
        await page.locator('button:has-text("Sign In")').first().click();
        await page.waitForTimeout(3000);
      } catch (uiError: any) {
        console.error(`  ❌ UI login also failed: ${uiError.message}`);
        await page.screenshot({
          path: path.join(SESSIONS_DIR, `${role}-login-failed.png`),
          fullPage: true,
        });
        await context.close();
        return false;
      }
    } else {
      console.log(`  ✓ Login API successful`);
      await page.waitForTimeout(2000);
    }

    // Step 3: Verify login by navigating to /home
    console.log(`  → Verifying login at /home`);
    await page.goto(`${BASE_URL}/home`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000);

    const finalUrl = page.url();
    console.log(`  → Final URL: ${finalUrl}`);

    // Check if we're still on /home (not redirected to /auth)
    if (finalUrl.includes("/auth")) {
      console.error(`  ❌ Login failed - redirected to auth page`);
      await page.screenshot({
        path: path.join(SESSIONS_DIR, `${role}-login-failed.png`),
        fullPage: true,
      });
      await context.close();
      return false;
    }

    console.log(`  ✓ Login successful - on ${finalUrl}`);

    // Step 4: Save storage state
    const sessionPath = path.join(SESSIONS_DIR, `${role}.json`);
    await context.storageState({ path: sessionPath });
    console.log(`  ✓ Session saved: ${sessionPath}`);

    // Step 5: Take verification screenshot
    const screenshotPath = path.join(SESSIONS_DIR, `${role}-home-verified.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`  ✓ Screenshot: ${screenshotPath}`);

    // Step 6: Test creator-specific page if creator
    if (role === "creator") {
      console.log(`  → Testing creator page: /creator/new-post`);
      await page.goto(`${BASE_URL}/creator/new-post`, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(2000);

      const creatorUrl = page.url();
      console.log(`  → Creator page URL: ${creatorUrl}`);

      if (!creatorUrl.includes("/auth")) {
        const creatorScreenshot = path.join(SESSIONS_DIR, `${role}-new-post-verified.png`);
        await page.screenshot({ path: creatorScreenshot, fullPage: true });
        console.log(`  ✓ Creator page screenshot: ${creatorScreenshot}`);
      }
    }

    await context.close();
    return true;
  } catch (error: any) {
    console.error(`  ❌ Error bootstrapping ${role} session: ${error.message}`);

    // Take error screenshot
    try {
      await page.screenshot({
        path: path.join(SESSIONS_DIR, `${role}-error.png`),
        fullPage: true,
      });
    } catch (e) {
      // Ignore screenshot errors
    }

    await context.close();
    return false;
  }
}

/**
 * Main execution
 */
async function main() {
  console.log("🚀 Bootstrap Authentication Sessions");
  console.log(`📍 Base URL: ${BASE_URL}`);
  console.log(`📁 Sessions dir: ${SESSIONS_DIR}`);
  console.log("=".repeat(60));

  ensureSessionsDir();

  let browser: Browser | null = null;
  const results: Record<string, boolean> = {};

  try {
    console.log("\n🌐 Launching browser...");
    browser = await chromium.launch({ headless: false }); // Use headed for debugging
    console.log("  ✓ Browser launched");

    // Bootstrap fan session
    results.fan = await bootstrapSession(browser, "fan");

    // Bootstrap creator session
    results.creator = await bootstrapSession(browser, "creator");

    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("📊 BOOTSTRAP SUMMARY");
    console.log("=".repeat(60));
    console.log(`Fan session: ${results.fan ? "✅ SUCCESS" : "❌ FAILED"}`);
    console.log(`Creator session: ${results.creator ? "✅ SUCCESS" : "❌ FAILED"}`);

    if (results.fan && results.creator) {
      console.log("\n✅ All sessions bootstrapped successfully");
      console.log("\nSession files created:");
      console.log(`  - ${path.join(SESSIONS_DIR, "fan.json")}`);
      console.log(`  - ${path.join(SESSIONS_DIR, "creator.json")}`);
      process.exit(0);
    } else {
      console.log("\n❌ Some sessions failed to bootstrap");
      console.log("\nTroubleshooting:");
      console.log("1. Ensure dev server is running: pnpm dev");
      console.log("2. Create test accounts manually at /auth");
      console.log("3. Set correct credentials in environment:");
      console.log("   export FAN_EMAIL=fan@test.com");
      console.log("   export FAN_PASSWORD=TestPassword123!");
      console.log("   export CREATOR_EMAIL=creator@test.com");
      console.log("   export CREATOR_PASSWORD=TestPassword123!");
      process.exit(1);
    }
  } catch (error: any) {
    console.error(`\n❌ Bootstrap failed: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
      console.log("\n🔒 Browser closed");
    }
  }
}

// Run
if (require.main === module) {
  main();
}

export { main, bootstrapSession };
