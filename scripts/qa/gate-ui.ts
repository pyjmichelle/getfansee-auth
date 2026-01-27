#!/usr/bin/env tsx
/**
 * UI Gate - Required Selectors Check
 *
 * Verifies that critical UI elements exist on key pages.
 * Fails if any required selector is missing.
 */

import { chromium, Browser, BrowserContext, Page } from "playwright";
import * as fs from "fs";
import * as path from "path";
import { getBaseUrl } from "../_shared/env";

const BASE_URL = getBaseUrl();
const ARTIFACTS_DIR = path.join(process.cwd(), "artifacts", "qa");
const SESSIONS_DIR = path.join(process.cwd(), "artifacts", "agent-browser-full", "sessions");

interface UICheck {
  id: string;
  route: string;
  authState: "anonymous" | "fan" | "creator";
  selectors: SelectorCheck[];
}

interface SelectorCheck {
  selector: string;
  description: string;
  minCount?: number; // default 1
}

interface CheckResult {
  id: string;
  route: string;
  authState: string;
  status: "PASS" | "FAIL";
  checks: {
    selector: string;
    description: string;
    found: number;
    required: number;
    passed: boolean;
  }[];
  screenshot?: string;
  finalUrl: string;
}

const UI_CHECKS: UICheck[] = [
  {
    id: "home-posts",
    route: "/home",
    authState: "fan",
    selectors: [
      {
        selector: '[data-testid="post-card"]',
        description: "Post card should be visible",
        minCount: 1,
      },
    ],
  },
  {
    id: "wallet-balance",
    route: "/me/wallet",
    authState: "fan",
    selectors: [
      {
        selector: '[data-testid="wallet-balance"]',
        description: "Wallet balance section should be visible",
      },
    ],
  },
  {
    id: "new-post-form",
    route: "/creator/new-post",
    authState: "creator",
    selectors: [
      {
        selector: '[data-testid="post-title"]',
        description: "Post title input should be visible",
      },
      {
        selector: '[data-testid="post-content"]',
        description: "Post content textarea should be visible",
      },
      {
        selector: '[data-testid="upload-zone"]',
        description: "Upload zone should be visible",
      },
      {
        selector: '[data-testid="visibility-toggle"]',
        description: "Visibility toggle should be visible",
      },
      {
        selector: '[data-testid="submit-button"]',
        description: "Submit button should be visible",
      },
    ],
  },
  {
    id: "creator-studio",
    route: "/creator/studio",
    authState: "creator",
    selectors: [
      {
        selector: '[data-testid="creator-stats"]',
        description: "Creator stats section should be visible",
      },
      {
        selector: '[data-testid="creator-nav"]',
        description: "Creator navigation should be visible",
      },
    ],
  },
  {
    id: "creator-earnings",
    route: "/creator/studio/earnings",
    authState: "creator",
    selectors: [
      {
        selector: '[data-testid="earnings-balance"]',
        description: "Earnings balance section should be visible",
      },
      {
        selector: '[data-testid="earnings-history"]',
        description: "Earnings history section should be visible",
      },
    ],
  },
  {
    id: "search-modal",
    route: "/home",
    authState: "fan",
    selectors: [
      {
        selector: '[data-testid="search-button"], [data-testid="search-button-mobile"]',
        description: "Search button should be visible",
      },
    ],
  },
  // P0 Beta Compliance Checks
  {
    id: "age-gate",
    route: "/auth",
    authState: "anonymous",
    selectors: [
      {
        selector:
          '[data-testid="age-gate-yes"], [data-testid="age-gate-modal"], [data-slot="alert-dialog-overlay"]',
        description: "Age gate modal should be visible for anonymous users",
      },
    ],
  },
  {
    id: "checkout-disclaimer",
    route: "/me/wallet",
    authState: "fan",
    selectors: [
      {
        selector: '[data-testid="checkout-disclaimer"]',
        description: "Checkout disclaimer should be visible",
      },
      {
        selector: '[data-testid="terms-link"]',
        description: "Terms link should be visible",
      },
      {
        selector: '[data-testid="privacy-link"]',
        description: "Privacy link should be visible",
      },
      {
        selector: '[data-testid="no-refund"]',
        description: "No refund notice should be visible",
      },
      {
        selector: '[data-testid="balance-value"]',
        description: "Balance value should be visible",
      },
    ],
  },
  {
    id: "upload-file-input",
    route: "/creator/new-post",
    authState: "creator",
    selectors: [
      {
        selector: '[data-testid="upload-zone"]',
        description: "Upload zone with file input should exist",
      },
    ],
  },
];

function ensureArtifactsDir() {
  const screenshotsDir = path.join(ARTIFACTS_DIR, "screenshots");
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }
}

async function createAuthContext(
  browser: Browser,
  state: "anonymous" | "fan" | "creator"
): Promise<BrowserContext | null> {
  const baseOptions = {
    viewport: { width: 1280, height: 720 },
    baseURL: BASE_URL,
  };

  if (state === "anonymous") {
    return await browser.newContext(baseOptions);
  }

  const sessionPath = path.join(SESSIONS_DIR, `${state}.json`);

  if (!fs.existsSync(sessionPath)) {
    console.warn(`\n⚠️  Session file not found: ${sessionPath}`);
    console.warn(`   Skipping authenticated ${state} checks`);
    console.warn(`   To enable: pnpm test:session:auto:${state}`);
    console.warn(`   This is expected in CI if session creation failed`);
    return null;
  }

  try {
    const sessionData = JSON.parse(fs.readFileSync(sessionPath, "utf-8"));
    const cookieCount = sessionData.cookies?.length || 0;

    if (cookieCount === 0) {
      console.warn(`\n⚠️  Session file exists but has no cookies: ${sessionPath}`);
      console.warn(`   This may indicate a login failure`);
      return null;
    }

    return await browser.newContext({
      ...baseOptions,
      storageState: sessionPath,
    });
  } catch (error: any) {
    console.error(`\n❌ Error loading session file: ${error.message}`);
    console.error(`   Path: ${sessionPath}`);
    return null;
  }
}

async function verifySession(page: Page, expectedRole: "fan" | "creator"): Promise<boolean> {
  try {
    const response = await page.goto(`${BASE_URL}/api/profile`, {
      waitUntil: "domcontentloaded",
      timeout: 10000,
    });

    if (!response || response.status() !== 200) {
      return false;
    }

    const data = await response.json();
    return data.profile?.role === expectedRole;
  } catch (e) {
    return false;
  }
}

async function runUICheck(browser: Browser, check: UICheck): Promise<CheckResult> {
  const result: CheckResult = {
    id: check.id,
    route: check.route,
    authState: check.authState,
    status: "PASS",
    checks: [],
    finalUrl: "",
  };

  let context: BrowserContext | null = null;
  let page: Page | null = null;

  try {
    console.log(`\n🔍 Checking: ${check.id}`);
    console.log(`   Route: ${check.route} (${check.authState})`);

    context = await createAuthContext(browser, check.authState);
    if (!context) {
      console.log(`   ⏭️  Skipping (session not available)`);
      // In CI, if session creation failed, we should fail the check
      // but provide clear error message
      if (process.env.CI === "true") {
        result.status = "FAIL";
        result.checks.push({
          selector: "session",
          description: `${check.authState} session required but not available. Check test:session:auto:${check.authState} step.`,
          found: 0,
          required: 1,
          passed: false,
        });
        return result;
      } else {
        // In local dev, just skip
        result.status = "FAIL";
        result.checks.push({
          selector: "session",
          description: `${check.authState} session required (run: pnpm test:session:auto:${check.authState})`,
          found: 0,
          required: 1,
          passed: false,
        });
        return result;
      }
    }
    page = await context.newPage();

    // Verify session if not anonymous
    if (check.authState !== "anonymous") {
      const sessionValid = await verifySession(page, check.authState);
      if (!sessionValid) {
        console.log(`   ⚠️  Session validation failed for ${check.authState}`);
        result.status = "FAIL";
        result.checks.push({
          selector: "session",
          description: "Session validation",
          found: 0,
          required: 1,
          passed: false,
        });
        return result;
      }
    }

    // For age-gate test, clear localStorage first to ensure modal shows
    if (check.id === "age-gate") {
      await page.goto(`${BASE_URL}${check.route}`, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      await page.evaluate(() => {
        localStorage.removeItem("getfansee_age_verified");
      });
      await page.reload({ waitUntil: "domcontentloaded" });
    } else {
      // Navigate to route
      await page.goto(`${BASE_URL}${check.route}`, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
    }

    // Wait for page to be ready using multiple strategies
    // Strategy 1: Wait for page-ready testid (preferred)
    try {
      await page.waitForSelector('[data-testid="page-ready"]', { timeout: 10000 });
      console.log(`   ✓ Page ready signal detected`);
    } catch (e) {
      // Fallback: wait for skeleton/loading states to disappear
      console.log(`   → No page-ready signal, using fallback...`);
      try {
        await page.waitForFunction(
          () => {
            const skeletons = document.querySelectorAll('.animate-pulse, [class*="skeleton"]');
            const loadingText = document.body.innerText.includes("Loading...");
            return skeletons.length === 0 && !loadingText;
          },
          { timeout: 15000 }
        );
      } catch (e2) {
        console.log(`   ⚠️  Page may still be loading`);
      }
    }

    // Strategy 2: Wait for network idle
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});

    // Small buffer for React hydration
    await page.waitForTimeout(500);

    // For age-gate, wait for the modal to appear (React needs time to check localStorage)
    if (check.id === "age-gate") {
      try {
        await page.waitForSelector(
          '[data-slot="alert-dialog-overlay"], [data-testid="age-gate-yes"]',
          { timeout: 5000 }
        );
      } catch (e) {
        console.log(`   ⚠️  Age gate did not appear within timeout`);
      }
    }

    result.finalUrl = page.url();

    // Check each selector
    for (const selectorCheck of check.selectors) {
      const minCount = selectorCheck.minCount || 1;
      const elements = await page.locator(selectorCheck.selector).all();
      const visibleCount = (
        await Promise.all(elements.map((el) => el.isVisible().catch(() => false)))
      ).filter(Boolean).length;

      const passed = visibleCount >= minCount;

      result.checks.push({
        selector: selectorCheck.selector,
        description: selectorCheck.description,
        found: visibleCount,
        required: minCount,
        passed,
      });

      if (!passed) {
        result.status = "FAIL";
        console.log(`   ❌ ${selectorCheck.description}`);
        console.log(`      Found: ${visibleCount}, Required: ${minCount}`);
      } else {
        console.log(`   ✓ ${selectorCheck.description}`);
      }
    }

    // Take screenshot
    const screenshotPath = path.join(ARTIFACTS_DIR, "screenshots", `${check.id}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    result.screenshot = screenshotPath;

    if (result.status === "PASS") {
      console.log(`   ✅ PASS`);
    } else {
      console.log(`   ❌ FAIL`);
    }
  } catch (error: any) {
    console.log(`   ❌ ERROR: ${error.message}`);
    result.status = "FAIL";
    result.checks.push({
      selector: "error",
      description: `Error: ${error.message}`,
      found: 0,
      required: 1,
      passed: false,
    });
  } finally {
    if (context) {
      await context.close();
    }
  }

  return result;
}

async function checkSearchModal(browser: Browser): Promise<CheckResult> {
  const result: CheckResult = {
    id: "search-modal-opens",
    route: "/home",
    authState: "fan",
    status: "PASS",
    checks: [],
    finalUrl: "",
  };

  let context: BrowserContext | null = null;
  let page: Page | null = null;

  try {
    console.log(`\n🔍 Checking: search-modal-opens`);
    console.log(`   Route: /home (fan)`);

    context = await createAuthContext(browser, "fan");
    if (!context) {
      console.log(`   ⏭️  Skipping (fan session not available)`);
      result.status = "FAIL";
      return result;
    }
    page = await context.newPage();

    // Verify session
    const sessionValid = await verifySession(page, "fan");
    if (!sessionValid) {
      console.log(`   ⚠️  Session validation failed`);
      result.status = "FAIL";
      return result;
    }

    // Navigate to home
    await page.goto(`${BASE_URL}/home`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    await page.waitForTimeout(2000);

    // Handle Age Gate if present
    const ageGateYes = page.locator('[data-testid="age-gate-yes"]');
    if (await ageGateYes.isVisible().catch(() => false)) {
      console.log(`   → Dismissing Age Gate...`);
      await ageGateYes.click();
      await page.waitForTimeout(1000);
    }

    result.finalUrl = page.url();

    // Find and click search button
    const searchButton = page
      .locator('[data-testid="search-button"], [data-testid="search-button-mobile"]')
      .first();
    const searchButtonVisible = await searchButton.isVisible().catch(() => false);

    if (!searchButtonVisible) {
      console.log(`   ❌ Search button not found`);
      result.status = "FAIL";
      result.checks.push({
        selector: '[data-testid="search-button"]',
        description: "Search button visible",
        found: 0,
        required: 1,
        passed: false,
      });
      return result;
    }

    // Click search button
    await searchButton.click();
    await Promise.race([
      page.waitForURL("**/search**", { timeout: 5000 }),
      page
        .locator('[data-testid="search-modal"]')
        .first()
        .waitFor({ state: "visible", timeout: 5000 }),
    ]).catch(() => {});

    const searchModal = page.locator('[data-testid="search-modal"]').first();
    const searchPage = page.locator('[data-testid="search-page"]').first();
    const modalVisible = await searchModal.isVisible().catch(() => false);
    const searchPageVisible = await searchPage.isVisible().catch(() => false);
    const navigatedToSearch = page.url().includes("/search");

    result.checks.push({
      selector: '[data-testid="search-modal"]',
      description: "Search modal opens after click",
      found: modalVisible ? 1 : 0,
      required: 1,
      passed: modalVisible,
    });

    result.checks.push({
      selector: '[data-testid="search-page"]',
      description: "Search page loads after click",
      found: searchPageVisible && navigatedToSearch ? 1 : 0,
      required: 1,
      passed: searchPageVisible && navigatedToSearch,
    });

    if (!modalVisible && !(searchPageVisible && navigatedToSearch)) {
      result.status = "FAIL";
      console.log(`   ❌ Search modal/page did not open`);
    } else {
      console.log(`   ✓ Search destination opened successfully`);
    }

    // Take screenshot
    const screenshotPath = path.join(ARTIFACTS_DIR, "screenshots", "search-modal.png");
    await page.screenshot({ path: screenshotPath, fullPage: true });
    result.screenshot = screenshotPath;

    if (result.status === "PASS") {
      console.log(`   ✅ PASS`);
    } else {
      console.log(`   ❌ FAIL`);
    }
  } catch (error: any) {
    console.log(`   ❌ ERROR: ${error.message}`);
    result.status = "FAIL";
  } finally {
    if (context) {
      await context.close();
    }
  }

  return result;
}

async function main() {
  console.log("🔍 UI Gate - Required Selectors Check");
  console.log("=".repeat(60));
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Checks: ${UI_CHECKS.length + 1}`);
  console.log("=".repeat(60));

  ensureArtifactsDir();

  const browser = await chromium.launch({ headless: true });
  const results: CheckResult[] = [];

  try {
    // Run UI checks
    for (const check of UI_CHECKS) {
      const result = await runUICheck(browser, check);
      results.push(result);
    }

    // Run search modal check
    const searchModalResult = await checkSearchModal(browser);
    results.push(searchModalResult);

    // Generate report
    const passed = results.filter((r) => r.status === "PASS").length;
    const failed = results.filter((r) => r.status === "FAIL").length;
    const total = results.length;

    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total,
        passed,
        failed,
        passRate: `${((passed / total) * 100).toFixed(1)}%`,
      },
      results,
    };

    // Save report
    const reportPath = path.join(ARTIFACTS_DIR, "gate-ui.json");
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log("\n" + "=".repeat(60));
    console.log("📊 UI GATE RESULTS");
    console.log("=".repeat(60));
    console.log(`Total: ${total}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Pass Rate: ${report.summary.passRate}`);
    console.log(`\nReport: ${reportPath}`);

    // Exit with appropriate code
    if (failed > 0) {
      console.error("\n" + "=".repeat(60));
      console.error("❌ UI GATE FAILED");
      console.error("=".repeat(60));
      console.error(`Failed checks: ${failed}`);
      console.error("\nFailed results:");
      results
        .filter((r) => r.status === "FAIL")
        .forEach((r) => {
          console.error(`\n  ❌ ${r.id} (${r.route}, ${r.authState})`);
          r.checks
            .filter((c) => !c.passed)
            .forEach((c) => {
              console.error(`     - ${c.description}: Found ${c.found}, Required ${c.required}`);
            });
        });
      console.error(`\nFull report: ${reportPath}`);
      process.exit(1);
    } else {
      console.log("\n" + "=".repeat(60));
      console.log("✅ UI GATE PASSED");
      console.log("=".repeat(60));
      process.exit(0);
    }
  } catch (error: any) {
    console.error("\n" + "=".repeat(60));
    console.error("❌ UI GATE ERROR");
    console.error("=".repeat(60));
    console.error(`Error: ${error.message}`);
    console.error(`Stack: ${error.stack}`);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
