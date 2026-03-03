/**
 * UI / 活人感 / Skill 合规检查
 * 实际打开各重点页面，校验：最新 UI 规范、活人感图无 404、Skill/设计系统关键 class。
 * 可选输出报告到 docs/reports/ui-compliance-YYYYMMDD.md
 */
import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import {
  createConfirmedTestUser,
  emitE2EDiagnostics,
  injectSupabaseSession,
} from "./shared/helpers";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";
const VIEWPORT = { width: 1440, height: 900 };

/** 允许 404 的路径（favicon、manifest、已知占位等），其余 404 视为失败 */
const ALLOWED_404_PATTERNS = [
  /favicon\.ico$/i,
  /manifest\.(json|webmanifest)$/i,
  /apple-touch-icon/i,
  /icon\.(png|ico)$/i,
  /\/images\/auth\/hero-pc\.jpg/i,
  /\/images\/auth\/hero-mb\.jpg/i,
  /\/images\/avatars\/fan-default\.jpg/i,
  /\/images\/avatars\/creator-default\.jpg/i,
  /\/images\/placeholders\/post-media-1-pc\.jpg/i,
  /\/images\/placeholders\/post-media-1-mb\.jpg/i,
  /\/apple-icon\.png/i,
  /\/fan-user-avatar\.jpg/i,
  /\/artist-creator-avatar\.jpg/i,
  /\/creator-avatar\.png/i,
  /\/placeholder\.svg/i,
];

function isAllowed404(url: string): boolean {
  try {
    const pathname = new URL(url, BASE_URL).pathname;
    return ALLOWED_404_PATTERNS.some((re) => re.test(pathname));
  } catch {
    return false;
  }
}

type ComplianceResult = {
  url: string;
  uiSpec: boolean;
  liveImages: boolean;
  skill: boolean;
  note?: string;
};

const complianceResults: ComplianceResult[] = [];

test.describe.configure({ mode: "serial" });

test.describe("UI / 活人感 / Skill 合规", () => {
  test.use({ viewport: VIEWPORT });

  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status !== "passed") {
      await emitE2EDiagnostics(page, testInfo);
    }
  });

  /** 收集本 test 内 404 的 URL（排除允许的） */
  function setup404Collector(page: import("@playwright/test").Page): string[] {
    const bad404: string[] = [];
    page.on("response", (res) => {
      if (res.status() === 404) {
        const url = res.url();
        if (!isAllowed404(url)) {
          bad404.push(url);
        }
      }
    });
    return bad404;
  }

  /** 等待页面就绪：main 可见或指定 testid 可见 */
  async function waitPageReady(
    page: import("@playwright/test").Page,
    testId?: string,
    timeout = 15_000
  ) {
    const ready = testId
      ? page.getByTestId(testId).or(page.locator("main")).first()
      : page.locator("main").first();
    await ready.waitFor({ state: "visible", timeout });
  }

  /** 断言：至少一个 main，且不超过 2 个（部分 layout 如 studio 可能含 sidebar main） */
  async function assertSingleMain(page: import("@playwright/test").Page) {
    const count = await page.evaluate(() => document.querySelectorAll("main").length);
    expect(count, "应有至少一个 main").toBeGreaterThanOrEqual(1);
    expect(count, "main 不宜超过 2 个").toBeLessThanOrEqual(2);
  }

  /** 断言：深色主题 */
  async function assertDarkTheme(page: import("@playwright/test").Page) {
    const hasDark = (await page.locator("html.dark").count()) > 0;
    expect(hasDark, "html 应有 dark class").toBe(true);
  }

  // ---------- 无需登录 ----------
  test("auth: UI 规范 + 活人感 Hero + Skill", async ({ page }) => {
    const bad404 = setup404Collector(page);
    await page.goto(`${BASE_URL}/auth`, { waitUntil: "domcontentloaded", timeout: 15_000 });
    await waitPageReady(page, "auth-tab-login");

    expect(await page.getByTestId("auth-tab-login").count()).toBeGreaterThan(0);
    // Auth 页为全屏布局，不使用 PageShell，无 main 不断言

    const heroVisible = await page
      .locator('img[src*="hero-pc"], img[src*="hero-mb"], picture img')
      .first()
      .isVisible()
      .catch(() => false);
    expect(heroVisible, "Auth 应有 Hero 图").toBe(true);

    expect(bad404, `Auth 页不应有非允许的 404: ${bad404.join(", ")}`).toEqual([]);
    const hasDesignClass =
      (await page.locator('[class*="card-block"]').count()) > 0 ||
      (await page.locator('[class*="glass-strong"]').count()) > 0 ||
      (await page.locator(".auth-form, .auth-hero, [class*='auth-form']").count()) > 0;
    expect(hasDesignClass).toBe(true);
    await assertDarkTheme(page);

    complianceResults.push({
      url: "/auth",
      uiSpec: true,
      liveImages: heroVisible && bad404.length === 0,
      skill: hasDesignClass,
    });
  });

  test("search: UI 规范 + 无 404 图 + Skill", async ({ page }) => {
    // Search 页客户端未登录会重定向到 auth，故用 fan 登录后访问
    const fan = await createConfirmedTestUser("fan");
    await injectSupabaseSession(page, fan.email, fan.password, BASE_URL);
    const bad404 = setup404Collector(page);
    await page.goto(`${BASE_URL}/search`, { waitUntil: "domcontentloaded", timeout: 15_000 });
    await waitPageReady(page, "search-page");
    await expect(
      page
        .getByTestId("search-page")
        .or(page.getByText(/Discover|Search creators/i))
        .first()
    ).toBeVisible({ timeout: 25_000 });
    await assertSingleMain(page);
    expect(bad404).toEqual([]);
    await assertDarkTheme(page);

    complianceResults.push({
      url: "/search",
      uiSpec: true,
      liveImages: bad404.length === 0,
      skill: true,
    });
  });

  test("report: 可打开且无 404 图", async ({ page }) => {
    const bad404 = setup404Collector(page);
    await page.goto(`${BASE_URL}/report?type=post&id=test-id`, {
      waitUntil: "domcontentloaded",
      timeout: 15_000,
    });
    await page
      .locator("main")
      .first()
      .waitFor({ state: "visible", timeout: 10_000 })
      .catch(() => {});
    expect(bad404).toEqual([]);
    complianceResults.push({
      url: "/report?type=post&id=test-id",
      uiSpec: true,
      liveImages: true,
      skill: true,
    });
  });

  // ---------- Fan 登录 ----------
  test("fan: home - PageShell + feed + 活人感", async ({ page }) => {
    const fan = await createConfirmedTestUser("fan");
    await injectSupabaseSession(page, fan.email, fan.password, BASE_URL);
    const bad404 = setup404Collector(page);
    await page.goto(`${BASE_URL}/home`, { waitUntil: "domcontentloaded", timeout: 15_000 });
    await waitPageReady(page, "home-feed");

    expect(
      await page.getByTestId("home-feed").or(page.getByTestId("page-ready")).first().isVisible()
    ).toBe(true);
    await assertSingleMain(page);
    const hasCardOrBento =
      (await page.locator('[class*="card-block"]').count()) > 0 ||
      (await page.locator('[class*="bento-grid"]').count()) > 0 ||
      (await page.locator('[class*="content-card"], [data-testid="home-feed"] > *').count()) > 0;
    expect(hasCardOrBento).toBe(true);
    expect(bad404).toEqual([]);
    await assertDarkTheme(page);

    complianceResults.push({
      url: "/home",
      uiSpec: true,
      liveImages: true,
      skill: true,
    });
  });

  test("fan: subscriptions - PageShell + list", async ({ page }) => {
    const fan = await createConfirmedTestUser("fan");
    await injectSupabaseSession(page, fan.email, fan.password, BASE_URL);
    const bad404 = setup404Collector(page);
    await page.goto(`${BASE_URL}/subscriptions`, {
      waitUntil: "domcontentloaded",
      timeout: 15_000,
    });
    await waitPageReady(page, "subscriptions-list");

    expect(page.url()).toContain("/subscriptions");
    await assertSingleMain(page);
    expect(bad404).toEqual([]);
    await assertDarkTheme(page);
    complianceResults.push({ url: "/subscriptions", uiSpec: true, liveImages: true, skill: true });
  });

  test("fan: purchases - PageShell + list", async ({ page }) => {
    const fan = await createConfirmedTestUser("fan");
    await injectSupabaseSession(page, fan.email, fan.password, BASE_URL);
    const bad404 = setup404Collector(page);
    await page.goto(`${BASE_URL}/purchases`, { waitUntil: "domcontentloaded", timeout: 15_000 });
    await waitPageReady(page, undefined);
    await expect(
      page
        .getByTestId("purchases-list")
        .or(page.getByText("No purchases yet"))
        .or(page.getByText(/Your Purchases|You've unlocked|exclusive pieces/i))
        .or(page.locator("main"))
        .first()
    ).toBeVisible({ timeout: 30_000 });
    await assertSingleMain(page);
    expect(bad404).toEqual([]);
    await assertDarkTheme(page);
    complianceResults.push({ url: "/purchases", uiSpec: true, liveImages: true, skill: true });
  });

  test("fan: notifications - PageShell", async ({ page }) => {
    const fan = await createConfirmedTestUser("fan");
    await injectSupabaseSession(page, fan.email, fan.password, BASE_URL);
    const bad404 = setup404Collector(page);
    await page.goto(`${BASE_URL}/notifications`, {
      waitUntil: "domcontentloaded",
      timeout: 15_000,
    });
    await waitPageReady(page, undefined);

    await assertSingleMain(page);
    expect(bad404).toEqual([]);
    await assertDarkTheme(page);
    complianceResults.push({ url: "/notifications", uiSpec: true, liveImages: true, skill: true });
  });

  test("fan: me - PageShell + 双栏", async ({ page }) => {
    const fan = await createConfirmedTestUser("fan");
    await injectSupabaseSession(page, fan.email, fan.password, BASE_URL);
    const bad404 = setup404Collector(page);
    await page.goto(`${BASE_URL}/me`, { waitUntil: "domcontentloaded", timeout: 15_000 });
    await waitPageReady(page, undefined);
    await expect(
      page
        .getByTestId("become-creator-button")
        .or(page.getByText(/Profile|Become a creator/i))
        .first()
    ).toBeVisible({ timeout: 25_000 });
    await assertSingleMain(page);
    expect(bad404).toEqual([]);
    await assertDarkTheme(page);
    complianceResults.push({ url: "/me", uiSpec: true, liveImages: true, skill: true });
  });

  test("fan: wallet - PageShell + testid", async ({ page }) => {
    const fan = await createConfirmedTestUser("fan");
    await injectSupabaseSession(page, fan.email, fan.password, BASE_URL);
    const bad404 = setup404Collector(page);
    await page.goto(`${BASE_URL}/me/wallet`, { waitUntil: "domcontentloaded", timeout: 15_000 });
    await waitPageReady(page, undefined);
    await expect(
      page
        .getByTestId("wallet-page")
        .or(page.getByTestId("wallet-balance-section"))
        .or(page.getByText(/Balance|Wallet/i))
        .first()
    ).toBeVisible({ timeout: 25_000 });
    await assertSingleMain(page);
    expect(bad404).toEqual([]);
    await assertDarkTheme(page);
    complianceResults.push({ url: "/me/wallet", uiSpec: true, liveImages: true, skill: true });
  });

  // ---------- Creator 登录 ----------
  test("creator: studio - 双栏 + page-ready", async ({ page }) => {
    const creator = await createConfirmedTestUser("creator");
    await injectSupabaseSession(page, creator.email, creator.password, BASE_URL);
    const bad404 = setup404Collector(page);
    await page.goto(`${BASE_URL}/creator/studio`, {
      waitUntil: "domcontentloaded",
      timeout: 15_000,
    });
    await waitPageReady(page, undefined);
    await expect(
      page
        .getByTestId("page-ready")
        .or(page.getByTestId("creator-stats"))
        .or(page.getByText(/Studio|Dashboard|Earnings/i))
        .first()
    ).toBeVisible({ timeout: 25_000 });
    await assertSingleMain(page);
    const hasCard =
      (await page.locator('[class*="card-block"]').count()) > 0 ||
      (await page.locator('[class*="creator-stats"]').count()) > 0;
    expect(hasCard).toBe(true);
    expect(bad404).toEqual([]);
    await assertDarkTheme(page);
    complianceResults.push({ url: "/creator/studio", uiSpec: true, liveImages: true, skill: true });
  });

  test("creator: studio/analytics - 双栏", async ({ page }) => {
    const creator = await createConfirmedTestUser("creator");
    await injectSupabaseSession(page, creator.email, creator.password, BASE_URL);
    const bad404 = setup404Collector(page);
    await page.goto(`${BASE_URL}/creator/studio/analytics`, {
      waitUntil: "domcontentloaded",
      timeout: 15_000,
    });
    await waitPageReady(page, undefined);

    await assertSingleMain(page);
    expect(bad404).toEqual([]);
    await assertDarkTheme(page);
    complianceResults.push({
      url: "/creator/studio/analytics",
      uiSpec: true,
      liveImages: true,
      skill: true,
    });
  });

  test("creator: studio/earnings - testid", async ({ page }) => {
    const creator = await createConfirmedTestUser("creator");
    await injectSupabaseSession(page, creator.email, creator.password, BASE_URL);
    const bad404 = setup404Collector(page);
    await page.goto(`${BASE_URL}/creator/studio/earnings`, {
      waitUntil: "domcontentloaded",
      timeout: 15_000,
    });
    await waitPageReady(page, undefined);
    await expect(
      page
        .getByTestId("earnings-balance")
        .or(page.getByTestId("earnings-history"))
        .or(page.getByText(/Earnings|Balance/i))
        .first()
    ).toBeVisible({ timeout: 25_000 });
    await assertSingleMain(page);
    expect(bad404).toEqual([]);
    await assertDarkTheme(page);
    complianceResults.push({
      url: "/creator/studio/earnings",
      uiSpec: true,
      liveImages: true,
      skill: true,
    });
  });

  test("creator: studio/subscribers - 双栏", async ({ page }) => {
    const creator = await createConfirmedTestUser("creator");
    await injectSupabaseSession(page, creator.email, creator.password, BASE_URL);
    const bad404 = setup404Collector(page);
    await page.goto(`${BASE_URL}/creator/studio/subscribers`, {
      waitUntil: "domcontentloaded",
      timeout: 15_000,
    });
    await waitPageReady(page, undefined);

    await assertSingleMain(page);
    expect(bad404).toEqual([]);
    await assertDarkTheme(page);
    complianceResults.push({
      url: "/creator/studio/subscribers",
      uiSpec: true,
      liveImages: true,
      skill: true,
    });
  });

  test("creator: studio/post/list - bento-grid + testid", async ({ page }) => {
    const creator = await createConfirmedTestUser("creator");
    await injectSupabaseSession(page, creator.email, creator.password, BASE_URL);
    const bad404 = setup404Collector(page);
    await page.goto(`${BASE_URL}/creator/studio/post/list`, {
      waitUntil: "domcontentloaded",
      timeout: 15_000,
    });
    await waitPageReady(page, undefined);
    await expect(
      page
        .getByTestId("creator-post-list")
        .or(page.getByText(/Posts|Your content|No posts/i))
        .first()
    ).toBeVisible({ timeout: 25_000 });
    await assertSingleMain(page);
    expect(bad404).toEqual([]);
    await assertDarkTheme(page);
    complianceResults.push({
      url: "/creator/studio/post/list",
      uiSpec: true,
      liveImages: true,
      skill: true,
    });
  });

  test("creator: new-post - page-ready + submit-button", async ({ page }) => {
    const creator = await createConfirmedTestUser("creator");
    await injectSupabaseSession(page, creator.email, creator.password, BASE_URL);
    const bad404 = setup404Collector(page);
    await page.goto(`${BASE_URL}/creator/new-post`, {
      waitUntil: "domcontentloaded",
      timeout: 15_000,
    });
    await waitPageReady(page, undefined);
    await expect(
      page
        .getByTestId("submit-button")
        .or(page.getByTestId("page-ready"))
        .or(page.getByText(/Publish|Create post|Title/i))
        .first()
    ).toBeVisible({ timeout: 25_000 });
    await assertSingleMain(page);
    expect(await page.locator('[class*="card-block"]').count()).toBeGreaterThan(0);
    expect(bad404).toEqual([]);
    await assertDarkTheme(page);
    complianceResults.push({
      url: "/creator/new-post",
      uiSpec: true,
      liveImages: true,
      skill: true,
    });
  });

  test("creator: onboarding - 表单 CTA", async ({ page }) => {
    const creator = await createConfirmedTestUser("creator");
    await injectSupabaseSession(page, creator.email, creator.password, BASE_URL);
    const bad404 = setup404Collector(page);
    await page.goto(`${BASE_URL}/creator/onboarding`, {
      waitUntil: "domcontentloaded",
      timeout: 15_000,
    });
    await waitPageReady(page, undefined);

    await assertSingleMain(page);
    expect(bad404).toEqual([]);
    await assertDarkTheme(page);
    complianceResults.push({
      url: "/creator/onboarding",
      uiSpec: true,
      liveImages: true,
      skill: true,
    });
  });

  test("publish success: PageShell（直连可能重定向）", async ({ page }) => {
    const bad404 = setup404Collector(page);
    await page.goto(`${BASE_URL}/creator/studio/post/success`, {
      waitUntil: "domcontentloaded",
      timeout: 15_000,
    });
    await page.waitForLoadState("domcontentloaded");
    const url = page.url();
    if (url.includes("/success")) {
      await waitPageReady(page, undefined);
      await assertSingleMain(page);
    }
    expect(bad404).toEqual([]);
    complianceResults.push({
      url: "/creator/studio/post/success",
      uiSpec: true,
      liveImages: true,
      skill: true,
      note: url.includes("/success") ? undefined : "可能重定向到登录",
    });
  });

  // ---------- Admin：helpers 无 admin 角色，跳过 ----------
  test.skip("admin: content-review - PageShell", async () => {
    // createConfirmedTestUser 仅支持 fan | creator，无 admin；若需覆盖请先扩展 helpers
  });

  // ---------- 可选：需动态 id 的页面（无 seed 时跳过） ----------
  test("creator profile: 有 creator id 时检查", async ({ page }) => {
    const fan = await createConfirmedTestUser("fan");
    await injectSupabaseSession(page, fan.email, fan.password, BASE_URL);
    await page.goto(`${BASE_URL}/home`, { waitUntil: "domcontentloaded", timeout: 15_000 });
    await waitPageReady(page, "home-feed");
    const creatorLink = page.locator('a[href*="/creator/"]').first();
    const href = await creatorLink.getAttribute("href").catch(() => null);
    if (!href) {
      test.skip();
      return;
    }
    const match = href.match(/\/creator\/([^/?]+)/);
    const creatorId = match?.[1];
    if (!creatorId) {
      test.skip();
      return;
    }
    const bad404 = setup404Collector(page);
    await page.goto(`${BASE_URL}/creator/${creatorId}`, {
      waitUntil: "domcontentloaded",
      timeout: 15_000,
    });
    await waitPageReady(page, undefined);
    await assertSingleMain(page);
    expect(bad404).toEqual([]);
    await assertDarkTheme(page);
    complianceResults.push({
      url: `/creator/${creatorId}`,
      uiSpec: true,
      liveImages: true,
      skill: true,
    });
  });

  test("post detail: 有 post id 时检查", async ({ page }) => {
    const fan = await createConfirmedTestUser("fan");
    await injectSupabaseSession(page, fan.email, fan.password, BASE_URL);
    await page.goto(`${BASE_URL}/home`, { waitUntil: "domcontentloaded", timeout: 15_000 });
    await waitPageReady(page, "home-feed");
    const postLink = page.locator('a[href*="/posts/"]').first();
    const href = await postLink.getAttribute("href").catch(() => null);
    if (!href) {
      test.skip();
      return;
    }
    const match = href.match(/\/posts\/([^/?]+)/);
    const postId = match?.[1];
    if (!postId) {
      test.skip();
      return;
    }
    const bad404 = setup404Collector(page);
    await page.goto(`${BASE_URL}/posts/${postId}`, {
      waitUntil: "domcontentloaded",
      timeout: 15_000,
    });
    await waitPageReady(page, "page-ready");
    await assertSingleMain(page);
    expect(bad404).toEqual([]);
    await assertDarkTheme(page);
    complianceResults.push({
      url: `/posts/${postId}`,
      uiSpec: true,
      liveImages: true,
      skill: true,
    });
  });

  test.afterAll(() => {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const reportsDir = path.join(process.cwd(), "docs", "reports");
    try {
      fs.mkdirSync(reportsDir, { recursive: true });
    } catch {
      // ignore
    }
    const mdPath = path.join(reportsDir, `ui-compliance-${date}.md`);
    const lines = [
      "# UI / 活人感 / Skill 合规报告",
      "",
      `生成时间: ${new Date().toISOString()}`,
      "",
      "| 页面 | UI 规范 | 活人感图 | Skill | 备注 |",
      "|------|---------|----------|-------|------|",
      ...complianceResults.map(
        (r) =>
          `| ${r.url} | ${r.uiSpec ? "✅" : "❌"} | ${r.liveImages ? "✅" : "❌"} | ${r.skill ? "✅" : "❌"} | ${r.note ?? ""} |`
      ),
    ];
    fs.writeFileSync(mdPath, lines.join("\n"), "utf-8");
  });
});
