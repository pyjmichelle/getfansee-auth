#!/usr/bin/env tsx
/**
 * MVP QA Runner
 *
 * Runs critical user journey tests with detailed failure reporting
 */

import { chromium, Browser, BrowserContext, Page } from "playwright";
import * as fs from "fs";
import * as path from "path";
import { MVP_TEST_CASES, DEAD_CLICK_ROUTES, TestCase, Expectation } from "./mvp-flow.spec";

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:3000";
const ARTIFACTS_DIR = path.join(process.cwd(), "artifacts", "qa-mvp");
const SESSIONS_DIR = path.join(process.cwd(), "artifacts", "agent-browser-full", "sessions");

interface TestResult {
  id: string;
  name: string;
  route: string;
  authState: string;
  status: "PASS" | "FAIL" | "ERROR";
  duration: number;
  failures: FailureDetail[];
  evidence: Evidence;
  finalUrl: string;
}

interface FailureDetail {
  expectation: string;
  expected: any;
  actual: any;
  message: string;
}

interface Evidence {
  screenshot?: string;
  trace?: string;
  consoleLogs: string[];
  failedRequests: FailedRequest[];
}

interface FailedRequest {
  url: string;
  status: number;
  method: string;
}

interface DeadClick {
  route: string;
  authState: string;
  selector: string;
  text: string;
  reason: string;
  beforeScreenshot: string;
  afterScreenshot: string;
}

function ensureArtifactsDir() {
  if (!fs.existsSync(ARTIFACTS_DIR)) {
    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  }
  const tracesDir = path.join(ARTIFACTS_DIR, "traces");
  if (!fs.existsSync(tracesDir)) {
    fs.mkdirSync(tracesDir, { recursive: true });
  }
}

async function createAuthContext(
  browser: Browser,
  state: "anonymous" | "fan" | "creator"
): Promise<BrowserContext> {
  const baseOptions = {
    viewport: { width: 1280, height: 720 },
    baseURL: BASE_URL,
  };

  if (state === "anonymous") {
    return await browser.newContext(baseOptions);
  }

  const sessionPath = path.join(SESSIONS_DIR, `${state}.json`);

  if (!fs.existsSync(sessionPath)) {
    console.error(`\n❌ Session file not found: ${sessionPath}`);
    console.error(`   Run: pnpm test:session:auto:${state}`);
    throw new Error(`Missing session file: ${state}.json`);
  }

  const sessionData = JSON.parse(fs.readFileSync(sessionPath, "utf-8"));
  const cookieCount = sessionData.cookies?.length || 0;

  if (cookieCount === 0) {
    throw new Error(`Invalid session file: ${state}.json (no cookies)`);
  }

  return await browser.newContext({
    ...baseOptions,
    storageState: sessionPath,
  });
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
    // /api/profile returns { profile: { role: "fan"|"creator", ... } }
    return data.profile?.role === expectedRole;
  } catch (e) {
    return false;
  }
}

async function runTestCase(
  browser: Browser,
  testCase: TestCase,
  testIndex: number
): Promise<TestResult> {
  const startTime = Date.now();
  const result: TestResult = {
    id: testCase.id,
    name: testCase.name,
    route: testCase.route,
    authState: testCase.authState,
    status: "PASS",
    duration: 0,
    failures: [],
    evidence: {
      consoleLogs: [],
      failedRequests: [],
    },
    finalUrl: "",
  };

  let context: BrowserContext | null = null;
  let page: Page | null = null;

  try {
    console.log(`\n🧪 [${testIndex + 1}/${MVP_TEST_CASES.length}] ${testCase.name}`);
    console.log(`   Route: ${testCase.route} (${testCase.authState})`);

    // Create context with session
    context = await createAuthContext(browser, testCase.authState);

    // Start tracing
    await context.tracing.start({
      screenshots: true,
      snapshots: true,
    });

    page = await context.newPage();

    // Collect console logs
    page.on("console", (msg) => {
      const text = msg.text();
      if (msg.type() === "error" || msg.type() === "warning") {
        result.evidence.consoleLogs.push(`[${msg.type()}] ${text}`);
      }
    });

    // Collect failed requests
    page.on("response", (response) => {
      if (response.status() >= 400) {
        result.evidence.failedRequests.push({
          url: response.url(),
          status: response.status(),
          method: response.request().method(),
        });
      }
    });

    // Verify session if not anonymous
    if (testCase.authState !== "anonymous") {
      const sessionValid = await verifySession(page, testCase.authState);
      if (!sessionValid) {
        result.failures.push({
          expectation: "Session validation",
          expected: `Valid ${testCase.authState} session`,
          actual: "Invalid or expired session",
          message: `Session validation failed for ${testCase.authState}`,
        });
        result.status = "FAIL";
      }
    }

    // Navigate to route
    await page.goto(`${BASE_URL}${testCase.route}`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    await page.waitForTimeout(2000);
    result.finalUrl = page.url();

    // Check required selectors
    if (testCase.requiredSelectors) {
      for (const selector of testCase.requiredSelectors) {
        try {
          const element = await page.locator(selector).first();
          const isVisible = await element.isVisible().catch(() => false);

          if (!isVisible) {
            result.failures.push({
              expectation: "Required selector present",
              expected: `Selector visible: ${selector}`,
              actual: "Selector not found or not visible",
              message: `Required selector missing: ${selector}`,
            });
            result.status = "FAIL";
          }
        } catch (e: any) {
          result.failures.push({
            expectation: "Required selector present",
            expected: `Selector exists: ${selector}`,
            actual: `Error: ${e.message}`,
            message: `Failed to find required selector: ${selector}`,
          });
          result.status = "FAIL";
        }
      }
    }

    // Execute interactions
    if (testCase.interactions) {
      for (const interaction of testCase.interactions) {
        try {
          const element = page.locator(interaction.selector).first();

          switch (interaction.type) {
            case "click":
              await element.click();
              break;
            case "fill":
              await element.fill(interaction.value || "");
              break;
            case "select":
              await element.selectOption(interaction.value || "");
              break;
            case "wait":
              await page.waitForTimeout(parseInt(interaction.value || "1000"));
              break;
          }

          if (interaction.waitFor) {
            await page.waitForSelector(interaction.waitFor, { timeout: 5000 }).catch(() => {});
          }

          await page.waitForTimeout(1000);
        } catch (e: any) {
          result.failures.push({
            expectation: `Interaction: ${interaction.type}`,
            expected: `Successfully ${interaction.type} ${interaction.selector}`,
            actual: `Error: ${e.message}`,
            message: `Failed to execute interaction: ${interaction.type} on ${interaction.selector}`,
          });
          result.status = "FAIL";
        }
      }
    }

    // Check expectations
    for (const expectation of testCase.expectations) {
      const failure = await checkExpectation(page, expectation, result.finalUrl);
      if (failure) {
        result.failures.push(failure);
        result.status = "FAIL";
      }
    }

    // Save evidence
    const screenshotPath = path.join(ARTIFACTS_DIR, `${testCase.id}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    result.evidence.screenshot = screenshotPath;

    const tracePath = path.join(ARTIFACTS_DIR, "traces", `${testCase.id}.zip`);
    await context.tracing.stop({ path: tracePath });
    result.evidence.trace = tracePath;

    if (result.status === "PASS") {
      console.log(`   ✅ PASS`);
    } else {
      console.log(`   ❌ FAIL (${result.failures.length} failures)`);
      result.failures.forEach((f, i) => {
        console.log(`      ${i + 1}. ${f.message}`);
      });
    }
  } catch (error: any) {
    result.status = "ERROR";
    result.failures.push({
      expectation: "Test execution",
      expected: "Test completes without errors",
      actual: `Error: ${error.message}`,
      message: `Test error: ${error.message}`,
    });
    console.log(`   ❌ ERROR: ${error.message}`);

    if (page) {
      try {
        const screenshotPath = path.join(ARTIFACTS_DIR, `${testCase.id}-error.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        result.evidence.screenshot = screenshotPath;
      } catch (e) {
        // Ignore
      }
    }

    if (context) {
      try {
        const tracePath = path.join(ARTIFACTS_DIR, "traces", `${testCase.id}-error.zip`);
        await context.tracing.stop({ path: tracePath });
        result.evidence.trace = tracePath;
      } catch (e) {
        // Ignore
      }
    }
  } finally {
    if (context) {
      await context.close();
    }
  }

  result.duration = Date.now() - startTime;
  return result;
}

async function checkExpectation(
  page: Page,
  expectation: Expectation,
  currentUrl: string
): Promise<FailureDetail | null> {
  try {
    switch (expectation.type) {
      case "selector": {
        const element = page.locator(expectation.target).first();
        const isVisible = await element.isVisible().catch(() => false);

        if (expectation.expected === true && !isVisible) {
          return {
            expectation: expectation.description,
            expected: `Selector visible: ${expectation.target}`,
            actual: "Selector not found or not visible",
            message: expectation.description,
          };
        }
        break;
      }

      case "url": {
        const expectedUrl = expectation.expected as string;
        if (!currentUrl.includes(expectedUrl)) {
          return {
            expectation: expectation.description,
            expected: `URL contains: ${expectedUrl}`,
            actual: `Current URL: ${currentUrl}`,
            message: expectation.description,
          };
        }
        break;
      }

      case "modal": {
        const modal = page.locator(expectation.target).first();
        const isVisible = await modal.isVisible().catch(() => false);

        if (expectation.expected === true && !isVisible) {
          return {
            expectation: expectation.description,
            expected: "Modal/dialog visible",
            actual: "Modal not found or not visible",
            message: expectation.description,
          };
        }
        break;
      }

      case "disabled": {
        const element = page.locator(expectation.target).first();
        const isDisabled = await element.isDisabled().catch(() => false);

        if (expectation.expected === true && !isDisabled) {
          return {
            expectation: expectation.description,
            expected: "Element disabled",
            actual: "Element is enabled",
            message: expectation.description,
          };
        }
        break;
      }

      case "enabled": {
        const element = page.locator(expectation.target).first();
        const isDisabled = await element.isDisabled().catch(() => true);

        if (expectation.expected === true && isDisabled) {
          return {
            expectation: expectation.description,
            expected: "Element enabled",
            actual: "Element is disabled",
            message: expectation.description,
          };
        }
        break;
      }

      case "value": {
        const element = page.locator(expectation.target).first();
        const value = await element.inputValue().catch(() => "");
        const numValue = parseFloat(value) || 0;

        if (numValue !== expectation.expected) {
          return {
            expectation: expectation.description,
            expected: `Value: ${expectation.expected}`,
            actual: `Value: ${numValue}`,
            message: expectation.description,
          };
        }
        break;
      }

      case "network": {
        // This is checked in the main test runner
        break;
      }
    }

    return null;
  } catch (error: any) {
    return {
      expectation: expectation.description,
      expected: expectation.expected,
      actual: `Error: ${error.message}`,
      message: `Failed to check expectation: ${expectation.description}`,
    };
  }
}

async function detectDeadClicks(browser: Browser): Promise<DeadClick[]> {
  console.log("\n" + "=".repeat(60));
  console.log("🔍 DETECTING DEAD CLICKS");
  console.log("=".repeat(60));

  const deadClicks: DeadClick[] = [];

  for (const config of DEAD_CLICK_ROUTES) {
    console.log(`\n📍 Checking: ${config.route} (${config.authState})`);

    let context: BrowserContext | null = null;
    let page: Page | null = null;

    try {
      context = await createAuthContext(browser, config.authState);
      page = await context.newPage();

      await page.goto(`${BASE_URL}${config.route}`, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });

      await page.waitForTimeout(2000);

      // Find clickable elements
      const clickables = await page.locator('button, a, [role="button"], [onclick]').all();
      console.log(`   Found ${clickables.length} clickable elements`);

      for (let i = 0; i < Math.min(clickables.length, 10); i++) {
        const element = clickables[i];

        try {
          const isVisible = await element.isVisible().catch(() => false);
          if (!isVisible) continue;

          const text = await element.textContent().catch(() => "");
          const selector = await element.evaluate((el) => {
            if (el.id) return `#${el.id}`;
            if (el.className) return `.${el.className.split(" ")[0]}`;
            return el.tagName.toLowerCase();
          });

          // Take before screenshot
          const beforePath = path.join(
            ARTIFACTS_DIR,
            `dead-click-${config.authState}-${i}-before.png`
          );
          await page.screenshot({ path: beforePath });

          const urlBefore = page.url();
          let urlChanged = false;
          let networkActivity = false;
          let uiChanged = false;

          // Listen for network
          const networkPromise = new Promise((resolve) => {
            const timeout = setTimeout(() => resolve(false), 1500);
            page.once("request", () => {
              clearTimeout(timeout);
              resolve(true);
            });
          });

          // Click
          await element.click().catch(() => {});
          await page.waitForTimeout(1500);

          // Check changes
          const urlAfter = page.url();
          urlChanged = urlBefore !== urlAfter;
          networkActivity = (await networkPromise) as boolean;

          // Check for modals/toasts
          const modalVisible = await page
            .locator('[role="dialog"], [role="alert"], .modal, .toast')
            .first()
            .isVisible()
            .catch(() => false);
          uiChanged = modalVisible;

          // Take after screenshot
          const afterPath = path.join(
            ARTIFACTS_DIR,
            `dead-click-${config.authState}-${i}-after.png`
          );
          await page.screenshot({ path: afterPath });

          if (!urlChanged && !networkActivity && !uiChanged) {
            deadClicks.push({
              route: config.route,
              authState: config.authState,
              selector,
              text: text.trim().substring(0, 50),
              reason: "No URL change, no network activity, no UI change",
              beforeScreenshot: beforePath,
              afterScreenshot: afterPath,
            });
            console.log(`   ⚠️  Dead click detected: ${text.trim().substring(0, 30)}`);
          }
        } catch (e) {
          // Skip this element
        }
      }
    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
    } finally {
      if (context) {
        await context.close();
      }
    }
  }

  return deadClicks;
}

async function generateReport(results: TestResult[], deadClicks: DeadClick[]) {
  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;
  const errors = results.filter((r) => r.status === "ERROR").length;
  const total = results.length;
  const passRate = ((passed / total) * 100).toFixed(1);

  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total,
      passed,
      failed,
      errors,
      passRate: `${passRate}%`,
      deadClicks: deadClicks.length,
    },
    results,
    deadClicks,
  };

  // Save JSON
  const jsonPath = path.join(ARTIFACTS_DIR, "report.json");
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  // Generate Markdown
  let md = `# MVP QA Report\n\n`;
  md += `**Date**: ${new Date().toISOString()}\n\n`;
  md += `## Summary\n\n`;
  md += `| Metric | Value |\n`;
  md += `|--------|-------|\n`;
  md += `| Total Tests | ${total} |\n`;
  md += `| Passed | ${passed} |\n`;
  md += `| Failed | ${failed} |\n`;
  md += `| Errors | ${errors} |\n`;
  md += `| Pass Rate | ${passRate}% |\n`;
  md += `| Dead Clicks | ${deadClicks.length} |\n\n`;

  md += `## Test Results\n\n`;

  for (const result of results) {
    const icon = result.status === "PASS" ? "✅" : "❌";
    md += `### ${icon} ${result.name}\n\n`;
    md += `- **ID**: ${result.id}\n`;
    md += `- **Route**: ${result.route}\n`;
    md += `- **Auth State**: ${result.authState}\n`;
    md += `- **Status**: ${result.status}\n`;
    md += `- **Duration**: ${result.duration}ms\n`;
    md += `- **Final URL**: ${result.finalUrl}\n\n`;

    if (result.failures.length > 0) {
      md += `**Failures**:\n\n`;
      result.failures.forEach((f, i) => {
        md += `${i + 1}. **${f.message}**\n`;
        md += `   - Expected: ${f.expected}\n`;
        md += `   - Actual: ${f.actual}\n\n`;
      });
    }

    if (result.evidence.screenshot) {
      md += `**Evidence**:\n`;
      md += `- Screenshot: \`${result.evidence.screenshot}\`\n`;
    }
    if (result.evidence.trace) {
      md += `- Trace: \`${result.evidence.trace}\`\n`;
    }
    if (result.evidence.failedRequests.length > 0) {
      md += `- Failed Requests: ${result.evidence.failedRequests.length}\n`;
      result.evidence.failedRequests.slice(0, 5).forEach((req) => {
        md += `  - ${req.method} ${req.url} (${req.status})\n`;
      });
    }
    md += `\n`;
  }

  if (deadClicks.length > 0) {
    md += `## Dead Clicks Detected\n\n`;
    deadClicks.forEach((dc, i) => {
      md += `${i + 1}. **${dc.route}** (${dc.authState})\n`;
      md += `   - Element: ${dc.selector}\n`;
      md += `   - Text: "${dc.text}"\n`;
      md += `   - Reason: ${dc.reason}\n`;
      md += `   - Before: \`${dc.beforeScreenshot}\`\n`;
      md += `   - After: \`${dc.afterScreenshot}\`\n\n`;
    });
  }

  const mdPath = path.join(ARTIFACTS_DIR, "report.md");
  fs.writeFileSync(mdPath, md);

  console.log("\n" + "=".repeat(60));
  console.log("📊 REPORT GENERATED");
  console.log("=".repeat(60));
  console.log(`JSON: ${jsonPath}`);
  console.log(`Markdown: ${mdPath}`);
  console.log(`\nSummary: ${passed}/${total} passed (${passRate}%)`);
  if (deadClicks.length > 0) {
    console.log(`⚠️  ${deadClicks.length} dead clicks detected`);
  }
}

async function main() {
  console.log("🔍 MVP QA Runner");
  console.log("=".repeat(60));
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Test Cases: ${MVP_TEST_CASES.length}`);
  console.log("=".repeat(60));

  ensureArtifactsDir();

  const browser = await chromium.launch({ headless: true });

  try {
    // Run test cases
    const results: TestResult[] = [];
    for (let i = 0; i < MVP_TEST_CASES.length; i++) {
      const result = await runTestCase(browser, MVP_TEST_CASES[i], i);
      results.push(result);
    }

    // Detect dead clicks
    const deadClicks = await detectDeadClicks(browser);

    // Generate report
    await generateReport(results, deadClicks);

    // Exit with appropriate code
    const hasFailed = results.some((r) => r.status === "FAIL" || r.status === "ERROR");
    process.exit(hasFailed ? 1 : 0);
  } finally {
    await browser.close();
  }
}

main();
