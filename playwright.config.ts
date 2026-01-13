import { defineConfig, devices } from "@playwright/test";

const defaultBaseUrl = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const parsedUrl = new URL(defaultBaseUrl);
const serverPort = parsedUrl.port || (parsedUrl.protocol === "https:" ? "443" : "80");

// 记录配置信息（用于调试）
console.log("[Playwright Config] CI:", !!process.env.CI);
console.log("[Playwright Config] Base URL:", defaultBaseUrl);

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// require('dotenv').config();

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: "./e2e",
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ["html"],
    ["list"], // 在 CI 中显示详细日志
  ],
  /* Global timeout */
  timeout: 60 * 1000, // 每个测试 60 秒超时
  /* Expect timeout */
  expect: {
    timeout: 10 * 1000, // expect 断言 10 秒超时
  },
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: defaultBaseUrl,
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  /* Configure projects for major browsers */
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

  /* Run your local dev server before starting the tests */
  // 如果服务器已经手动启动，禁用自动启动
  // 使用环境变量 PLAYWRIGHT_SKIP_SERVER=true 来跳过服务器启动
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
