#!/usr/bin/env tsx
/**
 * UI / 活人感 / Skill 合规走查脚本
 *
 * 真实打开每个重点页面，逐项检查并截图，输出可读报告。
 * 使用方式：先启动应用 (pnpm dev)，再运行本脚本：
 *   pnpm compliance:walkthrough
 *
 * 环境要求：
 * - .env.local 中配置 Supabase（NEXT_PUBLIC_SUPABASE_URL、SUPABASE_SERVICE_ROLE_KEY）
 * - 走查需登录页时，须启用 Test Session API：在 .env.local 中加 E2E=1 或 PLAYWRIGHT_TEST_MODE=true，
 *   然后 pnpm dev 启动应用（会加载 .env.local），再运行本脚本
 */

import { chromium, type Page } from "playwright";
import * as fs from "fs";
import * as path from "path";

// 加载 .env.local，使 Supabase 等环境变量在 tsx 运行时可用（与 playwright.config 一致）
const envLocalPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envLocalPath)) {
  const envContent = fs.readFileSync(envLocalPath, "utf-8");
  envContent.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const eq = trimmed.indexOf("=");
      if (eq > 0) {
        const key = trimmed.slice(0, eq).trim();
        const value = trimmed.slice(eq + 1).trim();
        if (key && !process.env[key]) process.env[key] = value;
      }
    }
  });
}
if (!process.env.NEXT_PUBLIC_TEST_MODE) process.env.NEXT_PUBLIC_TEST_MODE = "true";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || process.env.BASE_URL || "http://127.0.0.1:3000";
const VIEWPORT = { width: 1440, height: 900 };
const ARTIFACTS_DIR = path.join(process.cwd(), "docs", "reports", "walkthrough-screenshots");
const TIMEOUT_NAV = 30_000;
const TIMEOUT_READY = 35_000;

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

type PageCheck = {
  name: string;
  path: string;
  needAuth: "none" | "fan" | "creator";
  readyTestId?: string;
};

const PAGES: PageCheck[] = [
  { name: "Auth", path: "/auth", needAuth: "none", readyTestId: "auth-tab-login" },
  { name: "Search", path: "/search", needAuth: "fan" },
  { name: "Report", path: "/report?type=post&id=test-id", needAuth: "none" },
  { name: "Home Feed", path: "/home", needAuth: "fan", readyTestId: "home-feed" },
  {
    name: "Subscriptions",
    path: "/subscriptions",
    needAuth: "fan",
    readyTestId: "subscriptions-list",
  },
  { name: "Purchases", path: "/purchases", needAuth: "fan" },
  {
    name: "Notifications",
    path: "/notifications",
    needAuth: "fan",
    readyTestId: "notifications-list",
  },
  { name: "Me", path: "/me", needAuth: "fan", readyTestId: "me-page-ready" },
  { name: "Wallet", path: "/me/wallet", needAuth: "fan", readyTestId: "wallet-page" },
  { name: "Studio", path: "/creator/studio", needAuth: "creator", readyTestId: "page-ready" },
  {
    name: "Studio Analytics",
    path: "/creator/studio/analytics",
    needAuth: "creator",
    readyTestId: "analytics-ready",
  },
  {
    name: "Studio Earnings",
    path: "/creator/studio/earnings",
    needAuth: "creator",
    readyTestId: "earnings-balance",
  },
  {
    name: "Studio Subscribers",
    path: "/creator/studio/subscribers",
    needAuth: "creator",
    readyTestId: "subscribers-list",
  },
  {
    name: "Studio Post List",
    path: "/creator/studio/post/list",
    needAuth: "creator",
    readyTestId: "creator-post-list",
  },
  { name: "New Post", path: "/creator/new-post", needAuth: "creator", readyTestId: "page-ready" },
  {
    name: "Onboarding",
    path: "/creator/onboarding",
    needAuth: "creator",
    readyTestId: "onboarding-ready",
  },
  { name: "Publish Success", path: "/creator/studio/post/success", needAuth: "none" },
];

type CheckResult = {
  page: string;
  path: string;
  url: string;
  uiSpec: { mainCount: number; mainOk: boolean; testIdOk: boolean };
  liveImages: { noBad404: boolean; bad404Urls: string[]; heroVisible?: boolean };
  skill: { dark: boolean; designClass: boolean };
  screenshot: string;
  note?: string;
};

function setup404Collector(page: Page): string[] {
  const bad404: string[] = [];
  page.on("response", (res) => {
    if (res.status() === 404) {
      const url = res.url();
      if (!isAllowed404(url)) bad404.push(url);
    }
  });
  return bad404;
}

async function waitReady(page: Page, testId?: string): Promise<boolean> {
  const ready = testId
    ? page.getByTestId(testId).or(page.locator("main")).first()
    : page.locator("main").first();
  try {
    await ready.waitFor({ state: "visible", timeout: TIMEOUT_READY });
  } catch {
    return false;
  }

  try {
    await page.waitForFunction(
      () => {
        const pulses = document.querySelectorAll(".animate-pulse");
        const loadingTextPresent = Array.from(document.querySelectorAll("body *")).some((el) => {
          const text = (el.textContent || "").trim();
          return text === "Loading..." || text === "Loading profile...";
        });
        return pulses.length === 0 && !loadingTextPresent;
      },
      { timeout: 15_000 }
    );
  } catch {
    // skeleton 超时不阻塞，继续截图当前状态
  }

  await page.waitForTimeout(500);
  return true;
}

async function runChecks(
  page: Page,
  bad404: string[],
  check: PageCheck
): Promise<Omit<CheckResult, "page" | "path" | "url" | "screenshot" | "note">> {
  const mainCount = await page.evaluate(() => document.querySelectorAll("main").length);
  const isAuth = check.path.startsWith("/auth");
  const mainOk = isAuth ? true : mainCount >= 1 && mainCount <= 2;
  let testIdOk = true;
  if (check.readyTestId) {
    testIdOk = (await page.getByTestId(check.readyTestId).count()) > 0;
  }
  const dark = (await page.locator("html.dark").count()) > 0;
  const designClass =
    (await page.locator('[class*="card-block"]').count()) > 0 ||
    (await page.locator('[class*="glass-strong"]').count()) > 0 ||
    (await page.locator('[class*="bento-grid"]').count()) > 0;
  let heroVisible: boolean | undefined;
  if (check.path.startsWith("/auth")) {
    heroVisible = await page
      .locator('img[src*="hero-pc"], img[src*="hero-mb"], picture img')
      .first()
      .isVisible()
      .catch(() => false);
  }
  return {
    uiSpec: { mainCount, mainOk, testIdOk },
    liveImages: { noBad404: bad404.length === 0, bad404Urls: [...bad404], heroVisible },
    skill: { dark, designClass },
  };
}

async function main() {
  console.log("🔍 UI / 活人感 / Skill 合规走查");
  console.log(`📍 Base URL: ${BASE_URL}`);
  console.log(`📐 Viewport: ${VIEWPORT.width}×${VIEWPORT.height}`);
  console.log("");
  console.log("💡 若需走查需登录页，请先以测试模式启动应用：");
  console.log("   E2E=1 pnpm dev  或  PLAYWRIGHT_TEST_MODE=true pnpm dev");
  console.log("");

  if (!fs.existsSync(ARTIFACTS_DIR)) {
    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  }
  console.log(`📁 截图目录: ${ARTIFACTS_DIR}\n`);

  let createConfirmedTestUser:
    | ((role: "fan" | "creator") => Promise<{ email: string; password: string; userId: string }>)
    | null = null;
  let injectSupabaseSession:
    | ((page: Page, email: string, password: string, baseUrl: string) => Promise<void>)
    | null = null;
  let authAvailable = false;
  try {
    const helpers = await import("../tests/e2e/shared/helpers");
    createConfirmedTestUser = helpers.createConfirmedTestUser;
    injectSupabaseSession = helpers.injectSupabaseSession;
    authAvailable = true;
  } catch (e) {
    console.warn("⚠️ 未加载 E2E helpers，仅走查无需登录页面。\n");
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  const results: CheckResult[] = [];
  let fanCredentials: { email: string; password: string } | null = null;
  let creatorCredentials: { email: string; password: string } | null = null;

  for (const check of PAGES) {
    const slug = check.path.replace(/\?.*$/, "").replace(/\//g, "-").replace(/^-/, "") || "index";
    const screenshotName = `${slug}.png`;
    const screenshotPath = path.join(ARTIFACTS_DIR, screenshotName);

    process.stdout.write(`  ${check.name} (${check.path}) ... `);

    const bad404 = setup404Collector(page);

    try {
      if (
        check.needAuth === "fan" &&
        authAvailable &&
        createConfirmedTestUser &&
        injectSupabaseSession
      ) {
        if (!fanCredentials) {
          fanCredentials = await createConfirmedTestUser("fan");
        }
        const doInjectFan = () =>
          injectSupabaseSession(page, fanCredentials!.email, fanCredentials!.password, BASE_URL);
        try {
          await doInjectFan();
        } catch (e: any) {
          if ((e?.message || "").includes("Failed to fetch")) {
            await new Promise((r) => setTimeout(r, 3000));
            await doInjectFan();
          } else throw e;
        }
      } else if (
        check.needAuth === "creator" &&
        authAvailable &&
        createConfirmedTestUser &&
        injectSupabaseSession
      ) {
        if (!creatorCredentials) {
          creatorCredentials = await createConfirmedTestUser("creator");
        }
        const doInjectCreator = () =>
          injectSupabaseSession(
            page,
            creatorCredentials!.email,
            creatorCredentials!.password,
            BASE_URL
          );
        try {
          await doInjectCreator();
        } catch (e: any) {
          if ((e?.message || "").includes("Failed to fetch")) {
            await new Promise((r) => setTimeout(r, 3000));
            await doInjectCreator();
          } else throw e;
        }
      }

      const response = await page.goto(`${BASE_URL}${check.path}`, {
        waitUntil: "domcontentloaded",
        timeout: TIMEOUT_NAV,
      });
      const finalUrl = page.url();
      const ready = await waitReady(page, check.readyTestId);

      await page.screenshot({ path: screenshotPath, fullPage: false }).catch(() => {});

      const checks = await runChecks(page, bad404, check);

      results.push({
        page: check.name,
        path: check.path,
        url: finalUrl,
        ...checks,
        screenshot: screenshotName,
        note: !ready ? "未等到就绪选择器" : undefined,
      });

      const ok = checks.uiSpec.mainOk && checks.liveImages.noBad404 && checks.skill.dark;
      console.log(ok ? "✅" : "⚠️");
    } catch (e: any) {
      console.log("❌ " + (e?.message || String(e)).slice(0, 60));
      if (check.needAuth !== "none" && (e?.message || "").includes("Missing admin client")) {
        authAvailable = false;
      }
      await page.screenshot({ path: screenshotPath, fullPage: false }).catch(() => {});
      results.push({
        page: check.name,
        path: check.path,
        url: page.url(),
        uiSpec: { mainCount: 0, mainOk: false, testIdOk: false },
        liveImages: { noBad404: false, bad404Urls: [] },
        skill: { dark: false, designClass: false },
        screenshot: screenshotName,
        note: "走查异常: " + (e?.message || String(e)).slice(0, 80),
      });
    }
  }

  await browser.close();

  const date = new Date();
  const reportDate = date.toISOString().slice(0, 10).replace(/-/g, "");
  const reportTime = date.toTimeString().slice(0, 8).replace(/:/g, "");
  const reportPath = path.join(
    process.cwd(),
    "docs",
    "reports",
    `ui-walkthrough-${reportDate}-${reportTime}.md`
  );
  const reportDir = path.dirname(reportPath);
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });

  const lines: string[] = [
    "# UI / 活人感 / Skill 走查报告",
    "",
    `生成时间: ${date.toISOString()}`,
    `Base URL: ${BASE_URL}`,
    `Viewport: ${VIEWPORT.width}×${VIEWPORT.height}`,
    "",
    "## 汇总",
    "",
    "| 页面 | UI 规范 | 活人感图 | Skill | 截图 | 备注 |",
    "|------|---------|----------|-------|------|------|",
    ...results.map((r) => {
      const ui = r.uiSpec.mainOk && r.uiSpec.testIdOk ? "✅" : "❌";
      const live = r.liveImages.noBad404 && r.liveImages.heroVisible !== false ? "✅" : "❌";
      const skill = r.skill.dark && r.skill.designClass ? "✅" : "❌";
      const scr = `[${r.screenshot}](walkthrough-screenshots/${r.screenshot})`;
      return `| ${r.page} | ${ui} | ${live} | ${skill} | ${scr} | ${r.note ?? ""} |`;
    }),
    "",
    "## 详情",
    "",
  ];

  for (const r of results) {
    lines.push(`### ${r.page} (\`${r.path}\`)`);
    lines.push("");
    lines.push(`- **URL**: ${r.url}`);
    lines.push(`- **main 数量**: ${r.uiSpec.mainCount} (合格: 1–2)`);
    lines.push(`- **关键 testid**: ${r.uiSpec.testIdOk ? "有" : "无"}`);
    lines.push(
      `- **无非法 404**: ${r.liveImages.noBad404 ? "是" : "否"}${r.liveImages.bad404Urls.length ? ` — ${r.liveImages.bad404Urls.join(", ")}` : ""}`
    );
    if (r.liveImages.heroVisible !== undefined) {
      lines.push(`- **Auth Hero 图**: ${r.liveImages.heroVisible ? "可见" : "不可见"}`);
    }
    lines.push(`- **深色主题**: ${r.skill.dark ? "是" : "否"}`);
    lines.push(`- **设计系统 class**: ${r.skill.designClass ? "有" : "无"}`);
    if (r.note) lines.push(`- **备注**: ${r.note}`);
    lines.push("");
  }

  fs.writeFileSync(reportPath, lines.join("\n"), "utf-8");
  console.log("");
  console.log(`📄 报告已写入: ${reportPath}`);
  console.log(`📁 截图目录: ${ARTIFACTS_DIR}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
