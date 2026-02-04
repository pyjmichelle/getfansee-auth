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
const serverPort = parsedUrl.port || (parsedUrl.protocol === "https:" ? "443" : "80");
const cookieExpires = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30;

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
  /* 2 workers：97 用例单 worker 易超 25 分钟，双 worker 约 15–25 分钟跑完 */
  workers: 2,
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
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
  ],

  /* CI/自动启动时：build + start，日志落盘；本地推荐用 scripts/e2e/start-server.sh + run-paywall-video.sh */
  webServer: process.env.PLAYWRIGHT_SKIP_SERVER
    ? undefined
    : {
        command: `PLAYWRIGHT_TEST_MODE=true E2E=1 PORT=${serverPort} pnpm build && bash -lc 'PORT=${serverPort} E2E=1 PLAYWRIGHT_TEST_MODE=true pnpm start > .next/e2e-server.log 2>&1'`,
        url: `${defaultBaseUrl}/api/health`,
        reuseExistingServer: true,
        timeout: 180 * 1000,
        stdout: "pipe",
        stderr: "pipe",
      },
});
