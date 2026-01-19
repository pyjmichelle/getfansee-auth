#!/usr/bin/env tsx
/**
 * Frontend Smoke Test using agent-browser
 *
 * This script performs exploratory smoke testing on key frontend routes.
 * It captures snapshots, errors, and screenshots for manual review.
 *
 * NOT a replacement for Playwright E2E tests - this is for quick visual/structural checks.
 */

import { chromium, Browser, Page } from "playwright";
import { spawn, ChildProcess } from "child_process";
import * as fs from "fs";
import * as path from "path";

// Configuration
const PORT = process.env.PORT || "3000";
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${PORT}`;
const SKIP_SERVER = process.env.PLAYWRIGHT_SKIP_SERVER === "true";
const ARTIFACTS_DIR = path.join(process.cwd(), "artifacts", "agent-browser");
const SERVER_LOG_PATH = path.join(ARTIFACTS_DIR, "server.log");
const TIMEOUT = 30000; // 30s per route
const SERVER_TIMEOUT = 120000; // 120s for server startup

// Routes to test
const ROUTES = [
  { path: "/auth", name: "auth" },
  { path: "/home", name: "home" },
  { path: "/creator/new-post", name: "creator-new-post" },
  { path: "/me/wallet", name: "me-wallet" },
  { path: "/creator/upgrade", name: "creator-upgrade" },
];

// Buttons to look for and click (best-effort)
const INTERACTIVE_BUTTONS = [
  "Continue",
  "Submit",
  "Unlock",
  "Recharge",
  "Get Started",
  "Sign In",
  "Sign Up",
];

interface RouteResult {
  route: string;
  success: boolean;
  snapshot?: any;
  errors: string[];
  screenshot?: string;
  interactions: string[];
  duration: number;
}

/**
 * Ensure artifacts directory exists
 */
function ensureArtifactsDir() {
  if (!fs.existsSync(ARTIFACTS_DIR)) {
    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  }
  console.log(`📁 Artifacts directory: ${ARTIFACTS_DIR}`);
}

/**
 * Capture page snapshot (DOM structure)
 */
async function captureSnapshot(page: Page, routeName: string): Promise<any> {
  try {
    // Get page content and basic structure
    const snapshot = await page.evaluate(() => {
      const getElementInfo = (el: Element) => ({
        tag: el.tagName.toLowerCase(),
        id: el.id || undefined,
        classes: Array.from(el.classList),
        text: el.textContent?.substring(0, 100) || undefined,
      });

      return {
        title: document.title,
        url: window.location.href,
        headings: Array.from(document.querySelectorAll("h1, h2, h3")).map(getElementInfo),
        buttons: Array.from(document.querySelectorAll("button, [role='button']")).map(
          getElementInfo
        ),
        forms: Array.from(document.querySelectorAll("form")).map(getElementInfo),
        links: Array.from(document.querySelectorAll("a[href]")).slice(0, 20).map(getElementInfo),
        errors: Array.from(document.querySelectorAll("[role='alert'], .error, .text-red-500")).map(
          getElementInfo
        ),
      };
    });

    const snapshotPath = path.join(ARTIFACTS_DIR, `${routeName}.json`);
    fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));
    console.log(`  ✓ Snapshot saved: ${snapshotPath}`);

    return snapshot;
  } catch (error) {
    console.error(`  ✗ Snapshot failed: ${error}`);
    return null;
  }
}

/**
 * Capture console errors and network errors
 */
async function captureErrors(page: Page, routeName: string): Promise<string[]> {
  const errors: string[] = [];

  // Listen for console errors
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      errors.push(`Console Error: ${msg.text()}`);
    }
  });

  // Listen for page errors
  page.on("pageerror", (error) => {
    errors.push(`Page Error: ${error.message}`);
  });

  // Listen for failed requests
  page.on("requestfailed", (request) => {
    errors.push(`Request Failed: ${request.url()} - ${request.failure()?.errorText}`);
  });

  return errors;
}

/**
 * Take screenshot
 */
async function captureScreenshot(page: Page, routeName: string): Promise<string | null> {
  try {
    const screenshotPath = path.join(ARTIFACTS_DIR, `${routeName}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`  ✓ Screenshot saved: ${screenshotPath}`);
    return screenshotPath;
  } catch (error) {
    console.error(`  ✗ Screenshot failed: ${error}`);
    return null;
  }
}

/**
 * Try to interact with obvious buttons (best-effort)
 */
async function tryInteractions(page: Page, snapshot: any): Promise<string[]> {
  const interactions: string[] = [];

  if (!snapshot?.buttons || snapshot.buttons.length === 0) {
    return interactions;
  }

  for (const buttonText of INTERACTIVE_BUTTONS) {
    try {
      // Try to find button by text (case-insensitive)
      const button = await page
        .locator(`button:has-text("${buttonText}"), [role="button"]:has-text("${buttonText}")`)
        .first();

      if (await button.isVisible({ timeout: 1000 }).catch(() => false)) {
        console.log(`  → Found button: "${buttonText}"`);
        // Don't actually click in smoke test - just log that it exists
        interactions.push(`Found: ${buttonText}`);
      }
    } catch (error) {
      // Button not found or not visible - that's okay
    }
  }

  return interactions;
}

/**
 * Test a single route
 */
async function testRoute(
  browser: Browser,
  route: { path: string; name: string }
): Promise<RouteResult> {
  const startTime = Date.now();
  const result: RouteResult = {
    route: route.path,
    success: false,
    errors: [],
    interactions: [],
    duration: 0,
  };

  let page: Page | null = null;

  try {
    console.log(`\n🧪 Testing route: ${route.path}`);

    page = await browser.newPage();

    // Set up error capture
    const errorCapture = captureErrors(page, route.name);

    // Navigate to route
    const response = await page.goto(`${BASE_URL}${route.path}`, {
      waitUntil: "networkidle",
      timeout: TIMEOUT,
    });

    if (!response) {
      throw new Error("No response received");
    }

    const status = response.status();
    console.log(`  → Status: ${status}`);

    if (status >= 400) {
      result.errors.push(`HTTP ${status}: ${response.statusText()}`);
    }

    // Wait a bit for client-side rendering
    await page.waitForTimeout(2000);

    // Capture snapshot
    result.snapshot = await captureSnapshot(page, route.name);

    // Capture screenshot
    result.screenshot = (await captureScreenshot(page, route.name)) || undefined;

    // Try interactions (best-effort)
    if (result.snapshot) {
      result.interactions = await tryInteractions(page, result.snapshot);
    }

    // Get captured errors
    result.errors = await errorCapture;

    // Save errors to file if any
    if (result.errors.length > 0) {
      const errorsPath = path.join(ARTIFACTS_DIR, `${route.name}-errors.txt`);
      fs.writeFileSync(errorsPath, result.errors.join("\n"));
      console.log(`  ⚠ Errors saved: ${errorsPath}`);
    }

    result.success = status < 400 && result.errors.length === 0;

    if (result.success) {
      console.log(`  ✅ Route OK`);
    } else {
      console.log(`  ⚠️  Route has issues (${result.errors.length} errors)`);
    }
  } catch (error: any) {
    console.error(`  ❌ Route failed: ${error.message}`);
    result.errors.push(`Test failed: ${error.message}`);
    result.success = false;
  } finally {
    if (page) {
      await page.close();
    }
    result.duration = Date.now() - startTime;
  }

  return result;
}

/**
 * Start dev server
 */
async function startDevServer(): Promise<ChildProcess | null> {
  if (SKIP_SERVER) {
    console.log("⏭️  Skipping server startup (PLAYWRIGHT_SKIP_SERVER=true)");
    return null;
  }

  console.log("\n🚀 Starting dev server...");
  console.log(`   PORT=${PORT} pnpm dev`);

  const serverLogStream = fs.createWriteStream(SERVER_LOG_PATH, { flags: "w" });

  const devServer = spawn("pnpm", ["dev"], {
    env: { ...process.env, PORT },
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
  });

  devServer.stdout?.pipe(serverLogStream);
  devServer.stderr?.pipe(serverLogStream);

  devServer.on("error", (err) => {
    console.error(`  ❌ Server spawn error: ${err.message}`);
  });

  // Wait for server to be ready
  console.log(`   Waiting for server at ${BASE_URL}/auth (timeout: ${SERVER_TIMEOUT}ms)...`);

  const startTime = Date.now();
  while (Date.now() - startTime < SERVER_TIMEOUT) {
    try {
      const response = await fetch(`${BASE_URL}/auth`, {
        method: "HEAD",
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok || response.status === 404 || response.status === 302) {
        console.log(`  ✓ Server ready (${Date.now() - startTime}ms)`);
        return devServer;
      }
    } catch (err) {
      // Server not ready yet, continue waiting
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.error(`  ❌ Server failed to start within ${SERVER_TIMEOUT}ms`);
  devServer.kill();
  return null;
}

/**
 * Stop dev server
 */
function stopDevServer(devServer: ChildProcess | null) {
  if (!devServer) return;

  console.log("\n🛑 Stopping dev server...");

  try {
    // Try graceful shutdown first
    devServer.kill("SIGTERM");

    // Force kill after 5s if still running
    setTimeout(() => {
      if (devServer.exitCode === null) {
        console.log("  ⚠️  Force killing server...");
        devServer.kill("SIGKILL");
      }
    }, 5000);

    console.log("  ✓ Server stopped");
  } catch (err: any) {
    console.error(`  ⚠️  Error stopping server: ${err.message}`);
  }
}

/**
 * Main execution
 */
async function main() {
  console.log("🚀 Frontend Smoke Test with agent-browser");
  console.log(`📍 Base URL: ${BASE_URL}`);
  console.log(`📋 Routes to test: ${ROUTES.length}`);
  console.log("=".repeat(60));

  ensureArtifactsDir();

  let browser: Browser | null = null;
  let devServer: ChildProcess | null = null;
  const results: RouteResult[] = [];

  try {
    // Start dev server if needed
    devServer = await startDevServer();
    if (!SKIP_SERVER && !devServer) {
      console.error("\n❌ Failed to start dev server. Aborting.");
      process.exit(1);
    }

    // Launch browser (use bundled Chromium, not system Chrome)
    console.log("\n🌐 Launching browser...");
    browser = await chromium.launch({
      headless: true,
      // Do NOT use channel: "chrome" - use bundled Chromium
    });
    console.log("  ✓ Browser launched");

    // Test each route
    for (const route of ROUTES) {
      const result = await testRoute(browser, route);
      results.push(result);
    }

    // Generate summary report
    console.log("\n" + "=".repeat(60));
    console.log("📊 SMOKE TEST SUMMARY");
    console.log("=".repeat(60));

    const passed = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;
    const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);

    console.log(`✅ Passed: ${passed}/${results.length}`);
    console.log(`❌ Failed: ${failed}/${results.length}`);
    console.log(`⚠️  Total Errors: ${totalErrors}`);

    // Detailed results
    console.log("\nDetailed Results:");
    results.forEach((result) => {
      const status = result.success ? "✅" : "❌";
      console.log(`  ${status} ${result.route} (${result.duration}ms)`);
      if (result.errors.length > 0) {
        result.errors.forEach((err) => console.log(`      - ${err}`));
      }
      if (result.interactions.length > 0) {
        console.log(`      Interactions: ${result.interactions.join(", ")}`);
      }
    });

    // Save summary JSON
    const summaryPath = path.join(ARTIFACTS_DIR, "summary.json");
    fs.writeFileSync(
      summaryPath,
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          baseUrl: BASE_URL,
          results,
          summary: { passed, failed, totalErrors },
        },
        null,
        2
      )
    );
    console.log(`\n📄 Summary saved: ${summaryPath}`);

    // Exit with error code if any tests failed
    if (failed > 0) {
      console.log("\n⚠️  Some routes failed smoke test");
      process.exit(1);
    } else {
      console.log("\n✅ All routes passed smoke test");
      process.exit(0);
    }
  } catch (error: any) {
    console.error(`\n❌ Smoke test failed: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
      console.log("\n🔒 Browser closed");
    }

    // Always cleanup server
    stopDevServer(devServer);

    if (!SKIP_SERVER) {
      console.log(`\n📄 Server logs saved: ${SERVER_LOG_PATH}`);
    }
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { main, testRoute, ROUTES };
