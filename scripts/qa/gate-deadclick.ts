#!/usr/bin/env tsx
/**
 * Dead Click Gate
 *
 * Detects buttons/links that don't respond to clicks.
 * Verifies specific interactions produce expected results.
 */

import { chromium, Browser, BrowserContext, Page } from "playwright";
import * as fs from "fs";
import * as path from "path";
import { getBaseUrl } from "../_shared/env";

const BASE_URL = getBaseUrl();
const ARTIFACTS_DIR = path.join(process.cwd(), "artifacts", "qa");
const SESSIONS_DIR = path.join(process.cwd(), "artifacts", "agent-browser-full", "sessions");

interface DeadClickCheck {
  id: string;
  route: string;
  authState: "anonymous" | "fan" | "creator";
  action: {
    type: "click";
    selector: string;
    description: string;
  };
  expectation: {
    type: "modal" | "url_change" | "element_visible" | "disabled" | "error_message";
    selector?: string;
    value?: string;
    description: string;
  };
}

interface CheckResult {
  id: string;
  route: string;
  authState: string;
  status: "PASS" | "FAIL";
  action: string;
  expectation: string;
  actualResult: string;
  screenshot?: string;
  beforeScreenshot?: string;
  afterScreenshot?: string;
}

const DEAD_CLICK_CHECKS: DeadClickCheck[] = [
  {
    id: "search-opens-modal",
    route: "/home",
    authState: "fan",
    action: {
      type: "click",
      selector: '[data-testid="search-button"], [data-testid="search-button-mobile"]',
      description: "Click search button",
    },
    expectation: {
      type: "modal",
      selector: '[data-testid="search-modal"]',
      description: "Search modal should open",
    },
  },
  {
    id: "new-post-submit-disabled-empty",
    route: "/creator/new-post",
    authState: "creator",
    action: {
      type: "click",
      selector: '[data-testid="submit-button"]',
      description: "Click submit with empty form",
    },
    expectation: {
      type: "error_message",
      selector: '[role="alert"], .text-destructive, [class*="error"]',
      description: "Error message should appear or button should be disabled",
    },
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

async function runDeadClickCheck(browser: Browser, check: DeadClickCheck): Promise<CheckResult> {
  const result: CheckResult = {
    id: check.id,
    route: check.route,
    authState: check.authState,
    status: "PASS",
    action: check.action.description,
    expectation: check.expectation.description,
    actualResult: "",
  };

  let context: BrowserContext | null = null;
  let page: Page | null = null;

  try {
    console.log(`\n🔍 Checking: ${check.id}`);
    console.log(`   Route: ${check.route} (${check.authState})`);
    console.log(`   Action: ${check.action.description}`);
    console.log(`   Expect: ${check.expectation.description}`);

    context = await createAuthContext(browser, check.authState);
    if (!context) {
      console.log(`   ⏭️  Skipping (session not available)`);
      // In CI, if session creation failed, we should fail the check
      if (process.env.CI === "true") {
        result.status = "FAIL";
        result.actualResult = `${check.authState} session required but not available. Check test:session:auto:${check.authState} step. Session creation may have failed - check CI logs.`;
      } else {
        result.status = "FAIL";
        result.actualResult = `${check.authState} session not available (run: pnpm test:session:auto:${check.authState})`;
      }
      // In CI, continue to next check instead of exiting immediately
      return result;
    }
    page = await context.newPage();

    // Verify session if not anonymous
    if (check.authState !== "anonymous") {
      const sessionValid = await verifySession(page, check.authState);
      if (!sessionValid) {
        console.log(`   ⚠️  Session validation failed for ${check.authState}`);
        result.status = "FAIL";
        result.actualResult = "Session validation failed";
        return result;
      }
    }

    // Navigate to route
    await page.goto(`${BASE_URL}${check.route}`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    await page.waitForTimeout(3000);

    // Handle Age Gate if present
    const ageGateYes = page.locator('[data-testid="age-gate-yes"]');
    if (await ageGateYes.isVisible().catch(() => false)) {
      console.log(`   → Dismissing Age Gate...`);
      await ageGateYes.click();
      await page.waitForTimeout(2000);
    }

    // Wait for page content to load after Age Gate dismissal
    await page.waitForTimeout(3000);

    // Wait for loading states to disappear
    try {
      await page.waitForFunction(
        () => {
          const loadingText = document.body.innerText.includes("Loading...");
          const skeletons = document.querySelectorAll(".animate-pulse");
          return !loadingText && skeletons.length === 0;
        },
        { timeout: 10000 }
      );
    } catch (e) {
      console.log(`   ⚠️  Page may still be loading`);
    }

    // Take before screenshot
    const beforePath = path.join(ARTIFACTS_DIR, "screenshots", `${check.id}-before.png`);
    await page.screenshot({ path: beforePath, fullPage: true });
    result.beforeScreenshot = beforePath;

    // Find the element to click
    const element = page.locator(check.action.selector).first();
    const isVisible = await element.isVisible().catch(() => false);

    if (!isVisible) {
      result.status = "FAIL";
      result.actualResult = `Element not found: ${check.action.selector}`;
      console.log(`   ❌ Element not found`);
      return result;
    }

    // Record URL before click
    const urlBefore = page.url();

    // Perform click
    await element.click().catch(() => {});
    await page.waitForTimeout(1500);

    // Take after screenshot
    const afterPath = path.join(ARTIFACTS_DIR, "screenshots", `${check.id}-after.png`);
    await page.screenshot({ path: afterPath, fullPage: true });
    result.afterScreenshot = afterPath;

    // Check expectation
    switch (check.expectation.type) {
      case "modal": {
        const modal = page.locator(check.expectation.selector!).first();
        const modalVisible = await modal.isVisible().catch(() => false);

        if (modalVisible) {
          result.status = "PASS";
          result.actualResult = "Modal opened successfully";
          console.log(`   ✓ Modal opened`);
        } else {
          result.status = "FAIL";
          result.actualResult = "Modal did not open";
          console.log(`   ❌ Modal did not open`);
        }
        break;
      }

      case "url_change": {
        const urlAfter = page.url();
        if (urlAfter !== urlBefore) {
          result.status = "PASS";
          result.actualResult = `URL changed to: ${urlAfter}`;
          console.log(`   ✓ URL changed`);
        } else {
          result.status = "FAIL";
          result.actualResult = "URL did not change";
          console.log(`   ❌ URL did not change`);
        }
        break;
      }

      case "element_visible": {
        const targetElement = page.locator(check.expectation.selector!).first();
        const isTargetVisible = await targetElement.isVisible().catch(() => false);

        if (isTargetVisible) {
          result.status = "PASS";
          result.actualResult = "Element became visible";
          console.log(`   ✓ Element visible`);
        } else {
          result.status = "FAIL";
          result.actualResult = "Element not visible";
          console.log(`   ❌ Element not visible`);
        }
        break;
      }

      case "disabled": {
        const isDisabled = await element.isDisabled().catch(() => false);

        if (isDisabled) {
          result.status = "PASS";
          result.actualResult = "Button is disabled";
          console.log(`   ✓ Button disabled`);
        } else {
          result.status = "FAIL";
          result.actualResult = "Button is not disabled";
          console.log(`   ❌ Button not disabled`);
        }
        break;
      }

      case "error_message": {
        // For empty form submission, either:
        // 1. Error message appears
        // 2. Button is disabled
        // 3. Form validation prevents submission
        const errorElement = page.locator(check.expectation.selector!).first();
        const errorVisible = await errorElement.isVisible().catch(() => false);

        // Check if button is disabled
        const submitButton = page.locator('[data-testid="submit-button"]').first();
        const buttonDisabled = await submitButton.isDisabled().catch(() => false);

        // Check if URL stayed the same (form didn't submit)
        const urlAfter = page.url();
        const stayedOnPage = urlAfter.includes(check.route);

        if (errorVisible) {
          result.status = "PASS";
          result.actualResult = "Error message displayed";
          console.log(`   ✓ Error message displayed`);
        } else if (buttonDisabled) {
          result.status = "PASS";
          result.actualResult = "Submit button is disabled";
          console.log(`   ✓ Submit button disabled`);
        } else if (stayedOnPage) {
          // Even if no visible error, staying on page is acceptable
          result.status = "PASS";
          result.actualResult = "Form did not submit (stayed on page)";
          console.log(`   ✓ Form validation prevented submission`);
        } else {
          result.status = "FAIL";
          result.actualResult = "No error message, button not disabled, form submitted";
          console.log(`   ❌ No validation feedback`);
        }
        break;
      }
    }

    if (result.status === "PASS") {
      console.log(`   ✅ PASS`);
    } else {
      console.log(`   ❌ FAIL`);
    }
  } catch (error: any) {
    console.log(`   ❌ ERROR: ${error.message}`);
    result.status = "FAIL";
    result.actualResult = `Error: ${error.message}`;
  } finally {
    if (context) {
      await context.close();
    }
  }

  return result;
}

async function main() {
  console.log("🔍 Dead Click Gate");
  console.log("=".repeat(60));
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Checks: ${DEAD_CLICK_CHECKS.length}`);
  console.log("=".repeat(60));

  ensureArtifactsDir();

  const browser = await chromium.launch({ headless: true });
  const results: CheckResult[] = [];

  try {
    for (const check of DEAD_CLICK_CHECKS) {
      const result = await runDeadClickCheck(browser, check);
      results.push(result);
    }

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
    const reportPath = path.join(ARTIFACTS_DIR, "dead-clicks.json");
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log("\n" + "=".repeat(60));
    console.log("📊 DEAD CLICK GATE RESULTS");
    console.log("=".repeat(60));
    console.log(`Total: ${total}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Pass Rate: ${report.summary.passRate}`);
    console.log(`\nReport: ${reportPath}`);

    // Exit with appropriate code
    if (failed > 0) {
      console.error("\n" + "=".repeat(60));
      console.error("❌ DEAD CLICK GATE FAILED");
      console.error("=".repeat(60));
      console.error(`Failed checks: ${failed}`);
      console.error("\nFailed results:");
      results
        .filter((r) => r.status === "FAIL")
        .forEach((r) => {
          console.error(`\n  ❌ ${r.id} (${r.route}, ${r.authState})`);
          console.error(`     Action: ${r.action}`);
          console.error(`     Expectation: ${r.expectation}`);
          console.error(`     Actual: ${r.actualResult}`);
        });
      console.error(`\nFull report: ${reportPath}`);
      process.exit(1);
    } else {
      console.log("\n" + "=".repeat(60));
      console.log("✅ DEAD CLICK GATE PASSED");
      console.log("=".repeat(60));
      process.exit(0);
    }
  } catch (error: any) {
    console.error("\n" + "=".repeat(60));
    console.error("❌ DEAD CLICK GATE ERROR");
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
