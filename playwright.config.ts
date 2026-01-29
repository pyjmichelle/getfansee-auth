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

const defaultBaseUrl = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const parsedUrl = new URL(defaultBaseUrl);
const serverPort = parsedUrl.port || (parsedUrl.protocol === "https:" ? "443" : "80");
const cookieExpires = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30;

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
  /* Global timeout - CI 长流程需更长时间，默认 4 分钟 */
  timeout: 240 * 1000,
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

  /* 本地开发/CI 时自动启动服务器 */
  webServer: process.env.PLAYWRIGHT_SKIP_SERVER
    ? undefined
    : {
        // 确保测试使用最新构建产物
        command: `PLAYWRIGHT_TEST_MODE=true NEXT_PUBLIC_TEST_MODE=true PORT=${serverPort} pnpm build && PLAYWRIGHT_TEST_MODE=true NEXT_PUBLIC_TEST_MODE=true PORT=${serverPort} pnpm start`,
        url: `${defaultBaseUrl}/api/health`, // 使用 health check endpoint
        reuseExistingServer: !process.env.CI, // CI 中不复用，确保干净启动
        timeout: 180 * 1000, // 增加到 3 分钟，确保 build + start 有足够时间
        stdout: "pipe",
        stderr: "pipe",
      },
});
