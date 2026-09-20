import { defineConfig, devices } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

// Load .env.local for Playwright tests
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

if (!process.env.PLAYWRIGHT_BASE_URL) {
  process.env.PLAYWRIGHT_BASE_URL = "http://127.0.0.1:3000";
}

if (!process.env.NEXT_PUBLIC_TEST_MODE) {
  process.env.NEXT_PUBLIC_TEST_MODE = "true";
}

const defaultBaseUrl = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";
const parsedUrl = new URL(defaultBaseUrl);
const localHosts = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);

if (!localHosts.has(parsedUrl.hostname) && process.env.E2E_ALLOW_ANY_HOST !== "true") {
  throw new Error(
    "Refusing to run E2E against a non-local host. Set E2E_ALLOW_ANY_HOST=true only for an explicitly approved test target."
  );
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleConfigured = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
if (supabaseUrl && serviceRoleConfigured) {
  const actualProjectRef = new URL(supabaseUrl).hostname.split(".")[0];
  const allowedProjectRef = process.env.E2E_SUPABASE_PROJECT_REF;
  if (!allowedProjectRef) {
    throw new Error(
      "E2E_SUPABASE_PROJECT_REF is required when E2E has a Supabase service-role key. Use a dedicated test project."
    );
  }
  if (actualProjectRef !== allowedProjectRef) {
    throw new Error("Refusing E2E: Supabase project does not match E2E_SUPABASE_PROJECT_REF.");
  }
}
const serverPort = parsedUrl.port || (parsedUrl.protocol === "https:" ? "443" : "80");
const cookieExpires = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30;
const authRealPattern = "**/auth-real/**/*.spec.ts";
const authMockPattern = "**/auth-mock/**/*.spec.ts";

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  /* Run tests in files in parallel */
  fullyParallel: false, // 串行执行，更稳定
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* CI 下重试 2 次提高稳定性，本地不重试便于快速失败 */
  retries: process.env.CI ? 2 : 0,
  /* CI 下单 worker 避免双文件并行时 navigation ERR_ABORTED；本地 2 workers 保速度 */
  workers: process.env.CI ? 1 : 2,
  /* Reporter */
  reporter: process.env.CI ? [["html"], ["github"]] : [["html"], ["list"]],
  /* Global timeout - CI 长流程需更长时间，默认 4 分钟 */
  timeout: 240 * 1000,
  /* Expect timeout */
  expect: {
    timeout: 15 * 1000,
  },
  /* Shared settings；contextOptions.reducedMotion 降低动画导致的 flaky */
  use: {
    baseURL: defaultBaseUrl,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    actionTimeout: 30 * 1000,
    navigationTimeout: 60 * 1000,
    ...((): { contextOptions?: { reducedMotion: "reduce" } } => ({
      contextOptions: { reducedMotion: "reduce" },
    }))(),
    ignoreHTTPSErrors: true,
    storageState: {
      cookies: [
        {
          name: "playwright-test-mode",
          value: "1",
          domain: parsedUrl.hostname,
          path: "/",
          expires: cookieExpires,
          httpOnly: false,
          secure: parsedUrl.protocol === "https:",
          sameSite: "Lax",
        },
      ],
      origins: [],
    },
  },

  /* 多浏览器测试 */
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: [authRealPattern, authMockPattern],
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
      testIgnore: [authRealPattern, authMockPattern],
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
      testIgnore: [authRealPattern, authMockPattern],
    },
    {
      name: "auth-mock-chromium",
      use: { ...devices["Desktop Chrome"] },
      testMatch: [authMockPattern],
    },
    {
      name: "auth-real-chromium",
      use: { ...devices["Desktop Chrome"] },
      testMatch: [authRealPattern],
    },
  ],

  /* CI/自动启动时：build + start，日志落盘；本地推荐用 scripts/e2e/start-server.sh + run-paywall-video.sh */
  webServer: process.env.PLAYWRIGHT_SKIP_SERVER
    ? undefined
    : {
        // NEXT_PUBLIC_TEST_MODE is a client-bundle-time constant (baked in at
        // `pnpm build`), unlike E2E/PLAYWRIGHT_TEST_MODE which routes read
        // live from process.env. It must be hardcoded here — relying on the
        // ambient shell env is fragile because .env.local ships with
        // NEXT_PUBLIC_TEST_MODE=false (a deliberate prod-safety default) and
        // Next's env loader does not reliably let an inherited process.env
        // value win over it across every Next/Turbopack version.
        command: `NEXT_PUBLIC_TEST_MODE=true PLAYWRIGHT_TEST_MODE=true E2E=1 PORT=${serverPort} pnpm build && bash -lc 'PORT=${serverPort} E2E=1 PLAYWRIGHT_TEST_MODE=true NEXT_PUBLIC_TEST_MODE=true pnpm start > .next/e2e-server.log 2>&1'`,
        url: `${defaultBaseUrl}/api/health`,
        reuseExistingServer: true,
        timeout: 180 * 1000,
        stdout: "pipe",
        stderr: "pipe",
      },
});
