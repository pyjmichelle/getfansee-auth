import { defineConfig, devices } from "@playwright/test";

const defaultBaseUrl = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const parsedUrl = new URL(defaultBaseUrl);
const serverPort = parsedUrl.port || (parsedUrl.protocol === "https:" ? "443" : "80");

// 记录配置信息（用于调试）
console.log("[Playwright Config] CI:", !!process.env.CI);
console.log("[Playwright Config] Base URL:", defaultBaseUrl);

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  /* Run tests in files in parallel */
  fullyParallel: false, // 串行执行，更稳定
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* 重试次数 - 重试后通过不会被标记为 flaky */
  retries: 0, // 不重试，避免 flaky 标记
  /* 使用单个 worker */
  workers: 1,
  /* Reporter */
  reporter: process.env.CI ? [["html"], ["github"]] : [["html"], ["list"]],
  /* Global timeout - 增加到 2 分钟 */
  timeout: 120 * 1000,
  /* Expect timeout */
  expect: {
    timeout: 15 * 1000,
  },
  /* Shared settings */
  use: {
    baseURL: defaultBaseUrl,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    actionTimeout: 30 * 1000,
    navigationTimeout: 60 * 1000,
    /* 增加重试网络请求 */
    ignoreHTTPSErrors: true,
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

  /* 本地开发时自动启动服务器 */
  webServer:
    process.env.CI || process.env.PLAYWRIGHT_SKIP_SERVER
      ? undefined
      : {
          command: `PORT=${serverPort} NEXT_DISABLE_DEV_OVERLAY=1 pnpm dev`,
          url: defaultBaseUrl,
          reuseExistingServer: true,
          timeout: 120 * 1000,
          stdout: "pipe",
          stderr: "pipe",
        },
});
