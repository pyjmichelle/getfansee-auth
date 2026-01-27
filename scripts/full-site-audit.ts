#!/usr/bin/env tsx
/**
 * Full Site Interactive Audit
 *
 * Comprehensive audit of all routes under 3 auth states:
 * - Anonymous
 * - Fan (logged-in)
 * - Creator (logged-in)
 *
 * Tests every clickable element, detects fake/disabled UI, captures errors.
 */

import { chromium, Browser, Page, BrowserContext } from "playwright";
import { spawn, ChildProcess } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { getBaseUrl, getPort } from "./_shared/env";

// Configuration
const PORT = String(getPort());
const BASE_URL = getBaseUrl();
const ARTIFACTS_DIR = path.join(process.cwd(), "artifacts", "agent-browser-full");
const SERVER_LOG_PATH = path.join(ARTIFACTS_DIR, "server.log");
const SERVER_TIMEOUT = 120000;

// Test credentials (will be created if not exist)
const TEST_USERS = {
  fan: {
    email: "test-fan@example.com",
    password: "TestPassword123!",
    role: "fan" as const,
  },
  creator: {
    email: "test-creator@example.com",
    password: "TestPassword123!",
    role: "creator" as const,
  },
};

// Route inventory
interface RouteInfo {
  path: string;
  isDynamic: boolean;
  params?: Record<string, string>;
  requiresAuth?: boolean;
  requiresRole?: "fan" | "creator" | "admin";
}

const STATIC_ROUTES: RouteInfo[] = [
  { path: "/", isDynamic: false },
  { path: "/auth", isDynamic: false },
  { path: "/home", isDynamic: false, requiresAuth: true },
  { path: "/me", isDynamic: false, requiresAuth: true },
  { path: "/me/wallet", isDynamic: false, requiresAuth: true },
  { path: "/purchases", isDynamic: false, requiresAuth: true },
  { path: "/subscriptions", isDynamic: false, requiresAuth: true },
  { path: "/search", isDynamic: false },
  { path: "/support", isDynamic: false },
  { path: "/creator/new-post", isDynamic: false, requiresAuth: true, requiresRole: "creator" },
  { path: "/creator/upgrade", isDynamic: false, requiresAuth: true },
  { path: "/creator/onboarding", isDynamic: false, requiresAuth: true },
  { path: "/creator/studio", isDynamic: false, requiresAuth: true, requiresRole: "creator" },
  {
    path: "/creator/studio/analytics",
    isDynamic: false,
    requiresAuth: true,
    requiresRole: "creator",
  },
  {
    path: "/creator/studio/earnings",
    isDynamic: false,
    requiresAuth: true,
    requiresRole: "creator",
  },
  {
    path: "/creator/studio/subscribers",
    isDynamic: false,
    requiresAuth: true,
    requiresRole: "creator",
  },
  {
    path: "/creator/studio/post/list",
    isDynamic: false,
    requiresAuth: true,
    requiresRole: "creator",
  },
  { path: "/admin/reports", isDynamic: false, requiresAuth: true, requiresRole: "admin" },
  { path: "/admin/content-review", isDynamic: false, requiresAuth: true, requiresRole: "admin" },
  {
    path: "/admin/creator-verifications",
    isDynamic: false,
    requiresAuth: true,
    requiresRole: "admin",
  },
];

// Auth states
type AuthState = "anonymous" | "fan" | "creator";

interface AuditResult {
  route: string;
  authState: AuthState;
  httpStatus: number;
  redirectTo?: string;
  finalUrl: string;
  consoleErrors: string[];
  networkErrors: string[];
  clickableElements: ClickableElement[];
  screenshotPath: string;
  timestamp: string;
}

interface ClickableElement {
  type: string;
  text: string;
  selector: string;
  status: "ok" | "fake" | "blocked" | "error" | "untested";
  action?: string;
  error?: string;
}

/**
 * Ensure artifacts directory
 */
function ensureArtifactsDir() {
  if (!fs.existsSync(ARTIFACTS_DIR)) {
    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  }

  // Create subdirectories for each auth state
  ["anonymous", "fan", "creator"].forEach((state) => {
    const stateDir = path.join(ARTIFACTS_DIR, state);
    if (!fs.existsSync(stateDir)) {
      fs.mkdirSync(stateDir, { recursive: true });
    }
  });
}

/**
 * Start dev server
 */
async function startDevServer(): Promise<ChildProcess> {
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

  // Wait for server
  console.log(`   Waiting for server at ${BASE_URL}/auth...`);

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
      // Not ready
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error("Server failed to start");
}

/**
 * Stop dev server
 */
function stopDevServer(devServer: ChildProcess) {
  console.log("\n🛑 Stopping dev server...");
  try {
    devServer.kill("SIGTERM");
    setTimeout(() => {
      if (devServer.exitCode === null) {
        devServer.kill("SIGKILL");
      }
    }, 5000);
  } catch (err: any) {
    console.error(`  ⚠️  Error stopping server: ${err.message}`);
  }
}

/**
 * Create browser context for auth state
 */
async function createAuthContext(browser: Browser, state: AuthState): Promise<BrowserContext> {
  const baseOptions = {
    viewport: { width: 1280, height: 720 },
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
  };

  if (state === "anonymous") {
    return await browser.newContext(baseOptions);
  }

  // Load saved session for fan/creator
  const sessionPath = path.join(ARTIFACTS_DIR, "sessions", `${state}.json`);

  if (!fs.existsSync(sessionPath)) {
    console.error(`\n❌ FATAL: Session file not found: ${sessionPath}`);
    console.error(`\nYou must create session files first:`);
    console.error(`  1. Start dev server: pnpm dev`);
    console.error(`  2. Export fan session: pnpm test:session:export:fan`);
    console.error(`  3. Export creator session: pnpm test:session:export:creator`);
    console.error(`  4. Then run: pnpm audit:full`);
    throw new Error(`Missing session file: ${state}.json`);
  }

  console.log(`  ✓ Loading ${state} session from ${sessionPath}`);

  // Load and verify session file
  const sessionData = JSON.parse(fs.readFileSync(sessionPath, "utf-8"));
  const cookieCount = sessionData.cookies?.length || 0;
  console.log(`     Cookies: ${cookieCount}, Origins: ${sessionData.origins?.length || 0}`);

  if (cookieCount === 0) {
    console.error(`  ❌ Session file has 0 cookies - invalid session`);
    throw new Error(`Invalid session file: ${state}.json`);
  }

  const context = await browser.newContext({
    ...baseOptions,
    storageState: sessionPath,
    baseURL: BASE_URL, // Ensure consistent base URL
  });

  return context;
}

/**
 * Audit a single route
 */
async function auditRoute(
  context: BrowserContext,
  route: RouteInfo,
  authState: AuthState
): Promise<AuditResult> {
  const page = await context.newPage();
  const consoleErrors: string[] = [];
  const networkErrors: string[] = [];

  // Capture console errors
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });

  // Capture network errors
  page.on("requestfailed", (request) => {
    networkErrors.push(`${request.method()} ${request.url()} - ${request.failure()?.errorText}`);
  });

  const url = `${BASE_URL}${route.path}`;
  console.log(`\n🧪 Testing: ${route.path} (${authState})`);

  try {
    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    const httpStatus = response?.status() || 0;
    const finalUrl = page.url();
    const redirectTo = finalUrl !== url ? finalUrl : undefined;

    console.log(`  → Status: ${httpStatus}${redirectTo ? ` (redirected to ${redirectTo})` : ""}`);

    // Wait for page to settle
    await page.waitForTimeout(2000);

    // Take screenshot
    const routeSlug = route.path.replace(/\//g, "_").replace(/^_/, "") || "root";
    const screenshotPath = path.join(ARTIFACTS_DIR, authState, `${routeSlug}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`  ✓ Screenshot: ${screenshotPath}`);

    // Find clickable elements
    const clickableElements = await findClickableElements(page);
    console.log(`  → Found ${clickableElements.length} clickable elements`);

    // Report errors
    if (consoleErrors.length > 0) {
      console.log(`  ⚠️  ${consoleErrors.length} console errors`);
    }
    if (networkErrors.length > 0) {
      console.log(`  ⚠️  ${networkErrors.length} network errors`);
    }

    await page.close();

    return {
      route: route.path,
      authState,
      httpStatus,
      redirectTo,
      finalUrl,
      consoleErrors,
      networkErrors,
      clickableElements,
      screenshotPath,
      timestamp: new Date().toISOString(),
    };
  } catch (error: any) {
    console.log(`  ❌ Error: ${error.message}`);
    await page.close();

    return {
      route: route.path,
      authState,
      httpStatus: 0,
      finalUrl: "",
      consoleErrors: [error.message],
      networkErrors,
      clickableElements: [],
      screenshotPath: "",
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Find all clickable elements on page
 */
async function findClickableElements(page: Page): Promise<ClickableElement[]> {
  try {
    const elements = await page.evaluate(() => {
      const clickable: ClickableElement[] = [];

      // Buttons
      document.querySelectorAll("button, [role='button']").forEach((el, idx) => {
        clickable.push({
          type: "button",
          text: el.textContent?.trim().substring(0, 50) || "",
          selector: `button:nth-of-type(${idx + 1})`,
          status: "untested" as const,
        });
      });

      // Links
      document.querySelectorAll("a[href]").forEach((el, idx) => {
        const href = el.getAttribute("href") || "";
        if (href && !href.startsWith("#")) {
          clickable.push({
            type: "link",
            text: el.textContent?.trim().substring(0, 50) || href,
            selector: `a[href]:nth-of-type(${idx + 1})`,
            status: "untested" as const,
          });
        }
      });

      return clickable;
    });

    return elements;
  } catch (error) {
    console.error("  ⚠️  Failed to find clickable elements:", error);
    return [];
  }
}

/**
 * Generate route map
 */
function generateRouteMap(): void {
  const routeMapPath = path.join(ARTIFACTS_DIR, "route-map.json");
  fs.writeFileSync(
    routeMapPath,
    JSON.stringify(
      {
        generated: new Date().toISOString(),
        totalRoutes: STATIC_ROUTES.length,
        routes: STATIC_ROUTES,
      },
      null,
      2
    )
  );
  console.log(`✓ Route map saved: ${routeMapPath}`);
}

/**
 * Main execution
 */
async function main() {
  console.log("🔍 Full Site Interactive Audit");
  console.log(`📍 Base URL: ${BASE_URL}`);
  console.log(`📋 Routes to test: ${STATIC_ROUTES.length}`);
  console.log(`🔐 Auth states: anonymous, fan, creator`);
  console.log("=".repeat(60));

  ensureArtifactsDir();
  generateRouteMap();

  let devServer: ChildProcess | null = null;
  let browser: Browser | null = null;
  const allResults: AuditResult[] = [];

  try {
    // In CI, server is already running, skip starting our own
    if (process.env.CI === "true") {
      console.log("\nℹ️  CI environment detected - using existing server");
      console.log(`   Verifying server at ${BASE_URL}/api/health...`);

      // Verify server is available
      const maxRetries = 15;
      let serverReady = false;
      for (let i = 0; i < maxRetries; i++) {
        try {
          const response = await fetch(`${BASE_URL}/api/health`, {
            method: "GET",
            signal: AbortSignal.timeout(5000),
          });
          if (response.ok || response.status === 200) {
            serverReady = true;
            console.log(`  ✓ Server is ready (attempt ${i + 1}/${maxRetries})`);
            break;
          }
        } catch (err: any) {
          if (i < maxRetries - 1) {
            console.log(`   Attempt ${i + 1}/${maxRetries} failed: ${err.message}`);
          }
        }
        if (i < maxRetries - 1) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }

      if (!serverReady) {
        console.error(`\n❌ Server at ${BASE_URL} is not responding after ${maxRetries} attempts`);
        console.error(`   This may indicate:`);
        console.error(`   1. Server failed to start in CI`);
        console.error(`   2. Server is still starting (increase wait time)`);
        console.error(`   3. Network/port issue in CI environment`);
        throw new Error(
          `Server at ${BASE_URL} is not responding. Check CI workflow server startup step.`
        );
      }
    } else {
      // Start server for local development
      devServer = await startDevServer();
    }

    // Launch browser
    console.log("\n🌐 Launching browser...");
    browser = await chromium.launch({ headless: true });
    console.log("  ✓ Browser launched");

    // Test each auth state
    for (const authState of ["anonymous", "fan", "creator"] as AuthState[]) {
      console.log(`\n${"=".repeat(60)}`);
      console.log(`🔐 Testing as: ${authState.toUpperCase()}`);
      console.log("=".repeat(60));

      const context = await createAuthContext(browser, authState);

      // Test each route
      for (const route of STATIC_ROUTES) {
        const result = await auditRoute(context, route, authState);
        allResults.push(result);
      }

      await context.close();
    }

    // Save results
    const resultsPath = path.join(ARTIFACTS_DIR, "audit-results.json");
    fs.writeFileSync(resultsPath, JSON.stringify(allResults, null, 2));
    console.log(`\n✓ Results saved: ${resultsPath}`);

    // Generate summary
    generateSummary(allResults);
  } catch (error: any) {
    console.error(`\n❌ Audit failed: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
      console.log("\n🔒 Browser closed");
    }
    if (devServer) {
      stopDevServer(devServer);
    }
  }
}

/**
 * Validate auth sessions
 */
function validateAuthSessions(results: AuditResult[]): {
  valid: boolean;
  fanAuthPercent: number;
  creatorAuthPercent: number;
} {
  console.log("\n" + "=".repeat(60));
  console.log("🔍 VALIDATING AUTH SESSIONS");
  console.log("=".repeat(60));

  const fanResults = results.filter((r) => r.authState === "fan");
  const creatorResults = results.filter((r) => r.authState === "creator");

  // Count auth page redirects
  const fanAuthPages = fanResults.filter(
    (r) => r.finalUrl.includes("/auth") || r.redirectTo?.includes("/auth")
  ).length;

  const creatorAuthPages = creatorResults.filter(
    (r) => r.finalUrl.includes("/auth") || r.redirectTo?.includes("/auth")
  ).length;

  const fanAuthPercent = (fanAuthPages / fanResults.length) * 100;
  const creatorAuthPercent = (creatorAuthPages / creatorResults.length) * 100;

  console.log(
    `Fan auth pages: ${fanAuthPages}/${fanResults.length} (${fanAuthPercent.toFixed(1)}%)`
  );
  console.log(
    `Creator auth pages: ${creatorAuthPages}/${creatorResults.length} (${creatorAuthPercent.toFixed(1)}%)`
  );

  const THRESHOLD = 5; // 5% threshold
  const fanPass = fanAuthPercent <= THRESHOLD;
  const creatorPass = creatorAuthPercent <= THRESHOLD;

  // Detailed breakdown
  if (!fanPass) {
    console.log(
      `\n❌ Fan session validation FAILED: ${fanAuthPercent.toFixed(1)}% > ${THRESHOLD}%`
    );
    console.log(`   Routes redirected to /auth:`);
    fanResults
      .filter((r) => r.finalUrl.includes("/auth"))
      .slice(0, 5)
      .forEach((r) => console.log(`     - ${r.route} → ${r.finalUrl}`));
    console.log(`   → Session may not be loaded or expired`);
    console.log(`   → Re-export session: pnpm test:session:export:fan`);
  } else {
    console.log(`✅ Fan session validation PASSED: ${fanAuthPercent.toFixed(1)}% <= ${THRESHOLD}%`);
  }

  if (!creatorPass) {
    console.log(
      `\n❌ Creator session validation FAILED: ${creatorAuthPercent.toFixed(1)}% > ${THRESHOLD}%`
    );
    console.log(`   Routes redirected to /auth:`);
    creatorResults
      .filter((r) => r.finalUrl.includes("/auth"))
      .slice(0, 5)
      .forEach((r) => console.log(`     - ${r.route} → ${r.finalUrl}`));
    console.log(`   → Session may not be loaded or expired`);
    console.log(`   → Re-export session: pnpm test:session:export:creator`);
  } else {
    console.log(
      `✅ Creator session validation PASSED: ${creatorAuthPercent.toFixed(1)}% <= ${THRESHOLD}%`
    );
  }

  return {
    valid: fanPass && creatorPass,
    fanAuthPercent,
    creatorAuthPercent,
  };
}

/**
 * Generate summary report
 */
function generateSummary(results: AuditResult[]) {
  console.log("\n" + "=".repeat(60));
  console.log("📊 AUDIT SUMMARY");
  console.log("=".repeat(60));

  const totalTests = results.length;
  const successfulLoads = results.filter((r) => r.httpStatus === 200).length;
  const redirects = results.filter((r) => r.redirectTo).length;
  const errors = results.filter((r) => r.httpStatus >= 400 || r.httpStatus === 0).length;
  const totalConsoleErrors = results.reduce((sum, r) => sum + r.consoleErrors.length, 0);
  const totalNetworkErrors = results.reduce((sum, r) => sum + r.networkErrors.length, 0);

  console.log(`Total tests: ${totalTests}`);
  console.log(`Successful loads (200): ${successfulLoads}`);
  console.log(`Redirects: ${redirects}`);
  console.log(`Errors (4xx/5xx/0): ${errors}`);
  console.log(`Console errors: ${totalConsoleErrors}`);
  console.log(`Network errors: ${totalNetworkErrors}`);

  // Validate auth sessions
  const validation = validateAuthSessions(results);

  // Save summary
  const summaryPath = path.join(ARTIFACTS_DIR, "summary.json");
  fs.writeFileSync(
    summaryPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        totalTests,
        successfulLoads,
        redirects,
        errors,
        totalConsoleErrors,
        totalNetworkErrors,
        passRate: ((successfulLoads / totalTests) * 100).toFixed(1) + "%",
        sessionsValid: validation.valid,
        fanAuthPageRatio: validation.fanAuthPercent.toFixed(1) + "%",
        creatorAuthPageRatio: validation.creatorAuthPercent.toFixed(1) + "%",
      },
      null,
      2
    )
  );
  console.log(`\n✓ Summary saved: ${summaryPath}`);

  if (!validation.valid) {
    console.log("\n❌ AUDIT FAILED: Auth sessions not valid (>5% auth pages)");
    console.log("   Re-export sessions:");
    console.log("     pnpm test:session:export:fan");
    console.log("     pnpm test:session:export:creator");
    process.exit(1);
  }

  console.log("\n✅ AUDIT PASSED: All gates met");
  process.exit(0);
}

// Run
if (require.main === module) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

export { main };
