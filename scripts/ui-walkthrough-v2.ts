/**
 * UI 走查脚本 v2 — 登录后完整截图
 * 使用 Supabase Admin API 创建测试用户，Playwright 注入 session，覆盖全部页面
 *
 * 运行: E2E=1 pnpm tsx scripts/ui-walkthrough-v2.ts
 */

import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const BASE_URL = "http://localhost:3000";
const SCREENSHOT_DIR = path.join(__dirname, "../docs/reports/walkthrough-screenshots/v2");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// 确保截图目录存在
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface TestUser {
  email: string;
  password: string;
  userId: string;
  role: "fan" | "creator";
}

async function createTestUser(role: "fan" | "creator", suffix: string): Promise<TestUser> {
  const ts = Date.now();
  const email = `ui-walkthrough-${role}-${suffix}-${ts}@example.com`;
  const password = "WalkThrough2026!";

  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`Create user failed: ${error?.message}`);

  const userId = data.user.id;

  // 创建 profile
  await adminClient.from("profiles").upsert(
    {
      id: userId,
      display_name: role === "fan" ? "Demo Fan" : "Demo Creator",
      username: `walkthrough_${role}_${ts}`,
      role,
      bio: role === "creator" ? "I create exclusive content for my fans." : null,
      avatar_url: null,
    },
    { onConflict: "id" }
  );

  console.log(`✅ Created ${role} user: ${email}`);
  return { email, password, userId, role };
}

async function deleteTestUser(userId: string) {
  await adminClient.auth.admin.deleteUser(userId);
}

async function injectSession(page: import("playwright").Page, email: string, password: string) {
  // Use Supabase client in the browser context to sign in
  await page.goto(`${BASE_URL}/auth`, { waitUntil: "networkidle" });

  // Use the Supabase JS SDK directly via page.evaluate
  await page.evaluate(
    async ({ url, key, e, p }) => {
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      const sb = createClient(url, key);
      const { error } = await sb.auth.signInWithPassword({
        email: e,
        password: p,
      });
      if (error) throw new Error(error.message);
    },
    { url: SUPABASE_URL, key: ANON_KEY, e: email, p: password }
  );

  // Wait for session to be set
  await page.waitForTimeout(1500);
}

async function injectSessionViaUI(
  page: import("playwright").Page,
  email: string,
  password: string
) {
  await page.goto(`${BASE_URL}/auth`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);

  // Look for email input
  const emailInput = page.locator('input[type="email"], input[name="email"]').first();
  const passwordInput = page.locator('input[type="password"]').first();

  await emailInput.fill(email);
  await passwordInput.fill(password);

  // Find and click sign in button
  const signInBtn = page
    .locator('button[type="submit"]:has-text("Sign In"), button:has-text("Sign In")')
    .first();
  await signInBtn.click();

  // Wait for redirect
  await page.waitForURL(/\/(home|me|creator)/, { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1000);
  console.log(`✅ Logged in as ${email}, current url: ${page.url()}`);
}

interface PageSpec {
  url: string;
  name: string;
  waitFor?: string;
  skipIfRedirect?: boolean;
}

const PAGES: PageSpec[] = [
  // Public / Auth
  { url: "/auth", name: "auth" },

  // Fan pages
  { url: "/home", name: "home", waitFor: ".glass-card, main" },
  { url: "/search", name: "search", waitFor: "main" },
  { url: "/notifications", name: "notifications", waitFor: "main" },
  { url: "/me", name: "me", waitFor: "main" },
  { url: "/me/wallet", name: "me-wallet", waitFor: "main" },
  { url: "/subscriptions", name: "subscriptions", waitFor: "main" },
  { url: "/purchases", name: "purchases", waitFor: "main" },

  // Creator pages
  { url: "/creator/onboarding", name: "creator-onboarding", waitFor: "main" },
  { url: "/creator/studio", name: "creator-studio", waitFor: "main" },
  {
    url: "/creator/studio/analytics",
    name: "creator-analytics",
    waitFor: "main",
  },
  {
    url: "/creator/studio/earnings",
    name: "creator-earnings",
    waitFor: "main",
  },
  {
    url: "/creator/studio/post/list",
    name: "creator-post-list",
    waitFor: "main",
  },
  { url: "/creator/new-post", name: "creator-new-post", waitFor: "main" },

  // Static pages
  { url: "/terms", name: "terms", waitFor: "main" },
  { url: "/privacy", name: "privacy", waitFor: "main" },
  { url: "/dmca", name: "dmca", waitFor: "main" },
  { url: "/support", name: "support", waitFor: "main" },
];

async function screenshotPage(
  page: import("playwright").Page,
  spec: PageSpec,
  prefix: "mb" | "pc"
) {
  try {
    const url = `${BASE_URL}${spec.url}`;
    await page.goto(url, { waitUntil: "networkidle", timeout: 15000 });

    if (spec.waitFor) {
      await page
        .locator(spec.waitFor)
        .first()
        .waitFor({ timeout: 5000 })
        .catch(() => {});
    }
    await page.waitForTimeout(800);

    const filename = `${prefix}-${spec.name}.png`;
    const filepath = path.join(SCREENSHOT_DIR, filename);
    await page.screenshot({ path: filepath, fullPage: true });

    const currentUrl = page.url();
    const redirected = !currentUrl.includes(spec.url.split("?")[0]);
    console.log(
      `  📸 ${prefix} ${spec.name} → ${filename}${redirected ? ` (redirected to ${currentUrl})` : ""}`
    );

    // Check JS errors
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    if (errors.length > 0) {
      console.warn(`  ⚠️  JS errors on ${spec.name}:`, errors.slice(0, 3));
    }

    return { name: spec.name, prefix, ok: true, redirected, filepath };
  } catch (err) {
    console.error(`  ❌ Failed ${prefix} ${spec.name}:`, err);
    return { name: spec.name, prefix, ok: false, redirected: false, filepath: "" };
  }
}

async function main() {
  console.log("🚀 GetFanSee UI Walkthrough v2");
  console.log("━".repeat(50));

  let fanUser: TestUser | null = null;
  let creatorUser: TestUser | null = null;

  try {
    // Create test users
    console.log("\n📦 Creating test users...");
    fanUser = await createTestUser("fan", "walkthrough");
    creatorUser = await createTestUser("creator", "walkthrough");

    const browser = await chromium.launch({ headless: true });
    const results: Array<{
      name: string;
      prefix: string;
      ok: boolean;
      redirected: boolean;
      filepath: string;
    }> = [];

    // ── Mobile walkthrough (375px) ──────────────────────────────
    console.log("\n📱 Mobile walkthrough (375×812)...");
    const mbContext = await browser.newContext({
      viewport: { width: 375, height: 812 },
      deviceScaleFactor: 2,
    });
    const mbPage = await mbContext.newPage();

    // Capture console errors
    const mbErrors: string[] = [];
    mbPage.on("console", (msg) => {
      if (msg.type() === "error") mbErrors.push(`[${msg.location().url}] ${msg.text()}`);
    });

    // Auth page BEFORE login
    results.push(await screenshotPage(mbPage, { url: "/auth", name: "auth" }, "mb"));

    // Log in as creator (has more pages accessible)
    console.log("  🔐 Logging in as creator...");
    await injectSessionViaUI(mbPage, creatorUser.email, creatorUser.password);

    // Screenshot all pages
    for (const spec of PAGES.filter((p) => p.name !== "auth")) {
      results.push(await screenshotPage(mbPage, spec, "mb"));
    }

    await mbContext.close();

    // ── PC walkthrough (1440px) ──────────────────────────────────
    console.log("\n🖥️  PC walkthrough (1440×900)...");
    const pcContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
    });
    const pcPage = await pcContext.newPage();

    const pcErrors: string[] = [];
    pcPage.on("console", (msg) => {
      if (msg.type() === "error") pcErrors.push(`[${msg.location().url}] ${msg.text()}`);
    });

    // Auth page BEFORE login
    results.push(await screenshotPage(pcPage, { url: "/auth", name: "auth" }, "pc"));

    // Log in
    console.log("  🔐 Logging in as creator...");
    await injectSessionViaUI(pcPage, creatorUser.email, creatorUser.password);

    // Key PC pages
    const pcPages: PageSpec[] = [
      { url: "/home", name: "home", waitFor: "main" },
      { url: "/search", name: "search", waitFor: "main" },
      { url: "/me", name: "me", waitFor: "main" },
      { url: "/me/wallet", name: "me-wallet", waitFor: "main" },
      { url: "/creator/studio", name: "creator-studio", waitFor: "main" },
      { url: "/creator/studio/analytics", name: "creator-analytics", waitFor: "main" },
      { url: "/creator/studio/earnings", name: "creator-earnings", waitFor: "main" },
      { url: "/notifications", name: "notifications", waitFor: "main" },
      { url: "/subscriptions", name: "subscriptions", waitFor: "main" },
    ];

    for (const spec of pcPages) {
      results.push(await screenshotPage(pcPage, spec, "pc"));
    }

    await pcContext.close();
    await browser.close();

    // ── Summary Report ───────────────────────────────────────────
    console.log("\n" + "━".repeat(50));
    console.log("📊 WALKTHROUGH SUMMARY");
    console.log("━".repeat(50));

    const total = results.length;
    const ok = results.filter((r) => r.ok).length;
    const redirected = results.filter((r) => r.redirected).length;
    const failed = results.filter((r) => !r.ok).length;

    console.log(`Total: ${total} | ✅ ${ok} | ↩️  ${redirected} redirected | ❌ ${failed} failed`);
    console.log(`\nScreenshots saved to:\n  ${SCREENSHOT_DIR}`);

    if (mbErrors.length > 0) {
      console.warn("\n⚠️  Mobile console errors:", mbErrors.slice(0, 5));
    }
    if (pcErrors.length > 0) {
      console.warn("\n⚠️  PC console errors:", pcErrors.slice(0, 5));
    }

    // List redirected pages (likely auth-protected pages that need better auth)
    const redirectedList = results.filter((r) => r.redirected);
    if (redirectedList.length > 0) {
      console.log("\n↩️  Pages that redirected (may need auth):");
      redirectedList.forEach((r) => console.log(`   ${r.prefix}-${r.name}`));
    }
  } finally {
    // Cleanup test users
    console.log("\n🧹 Cleaning up test users...");
    if (fanUser) await deleteTestUser(fanUser.userId).catch(console.warn);
    if (creatorUser) await deleteTestUser(creatorUser.userId).catch(console.warn);
    console.log("✅ Done");
  }
}

main().catch(console.error);
