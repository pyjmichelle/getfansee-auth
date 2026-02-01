/**
 * Design QA 截图脚本：在固定 viewport (1440x900) 下对关键页面截图。
 * 截图保存到 tests/design-qa/screenshots/YYYY-MM-DD/
 * 登录使用 /api/test/session；等待 domcontentloaded + 关键元素可见（不用 waitForTimeout）。
 */
import { test, expect } from "@playwright/test";
import path from "path";
import { createConfirmedTestUser, injectSupabaseSession } from "../shared/helpers";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";
const SCREENSHOT_DATE = "2026-01-29";
const SCREENSHOT_DIR = path.join(
  process.cwd(),
  "tests",
  "design-qa",
  "screenshots",
  SCREENSHOT_DATE
);

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await require("fs").promises.mkdir(SCREENSHOT_DIR, { recursive: true });
});

test.describe("Design QA Screenshots", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("1. index (/) → redirects, then screenshot", async ({ page }) => {
    await page.goto(BASE_URL + "/", {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });
    await page.waitForLoadState("domcontentloaded");
    const url = page.url();
    if (url.includes("/auth")) {
      await expect(
        page.getByTestId("auth-tab-login").or(page.getByTestId("auth-tab-signup"))
      ).toBeVisible({ timeout: 10000 });
    } else if (url.includes("/home")) {
      await expect(page.getByTestId("home-feed").or(page.getByTestId("page-ready"))).toBeVisible({
        timeout: 10000,
      });
    }
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "index.png"),
      fullPage: true,
    });
  });

  test("2. auth-signup", async ({ page }) => {
    await page.goto(BASE_URL + "/auth?mode=signup", {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });
    await expect(page.getByTestId("auth-tab-signup")).toBeVisible({
      timeout: 10000,
    });
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "auth-signup.png"),
      fullPage: true,
    });
  });

  test("3. auth-login", async ({ page }) => {
    await page.goto(BASE_URL + "/auth?mode=login", {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });
    await expect(page.getByTestId("auth-tab-login")).toBeVisible({
      timeout: 10000,
    });
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "auth-login.png"),
      fullPage: true,
    });
  });

  test("4. home (requires fan login)", async ({ page }) => {
    const fan = await createConfirmedTestUser("fan");
    await injectSupabaseSession(page, fan.email, fan.password, BASE_URL);
    await page.goto(BASE_URL + "/home", {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });
    await expect(page.getByTestId("home-feed").or(page.getByTestId("page-ready"))).toBeVisible({
      timeout: 15000,
    });
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "home.png"),
      fullPage: true,
    });
  });

  test("5. creator-studio (requires creator login)", async ({ page }) => {
    const creator = await createConfirmedTestUser("creator");
    await injectSupabaseSession(page, creator.email, creator.password, BASE_URL);
    await page.goto(BASE_URL + "/creator/studio", {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });
    await expect(page.getByTestId("page-ready").or(page.getByTestId("creator-stats"))).toBeVisible({
      timeout: 15000,
    });
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "creator-studio.png"),
      fullPage: true,
    });
  });

  test("6. wallet (requires fan login)", async ({ page }) => {
    const fan = await createConfirmedTestUser("fan");
    await injectSupabaseSession(page, fan.email, fan.password, BASE_URL);
    await page.goto(BASE_URL + "/me/wallet", {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });
    await expect(
      page.getByTestId("wallet-page").or(page.getByTestId("wallet-balance-section"))
    ).toBeVisible({ timeout: 15000 });
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "wallet.png"),
      fullPage: true,
    });
  });
});
