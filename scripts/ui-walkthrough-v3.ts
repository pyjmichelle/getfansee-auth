/**
 * UI 走查脚本 v3 — 通过 /api/test/session 正确注入 session
 * 运行: pnpm tsx scripts/ui-walkthrough-v3.ts
 */

import { chromium, type BrowserContext, type Page } from "playwright";
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const BASE_URL = "http://localhost:3000";
const OUT_DIR = path.join(__dirname, "../docs/reports/walkthrough-screenshots/v2");

const SUPABASE_URL = "https://ordomkygjpujxyivwviq.supabase.co";
const SERVICE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yZG9ta3lnanB1anh5aXZ3dmlxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDQ4ODQ2NywiZXhwIjoyMDgwMDY0NDY3fQ.aDk8dVJfxCxxoGjejRje7-O-keDq59Bvw9oL7IsPIH4";

fs.mkdirSync(OUT_DIR, { recursive: true });

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Helpers ──────────────────────────────────────────────────────────────────

async function createUser(role: "fan" | "creator") {
  const ts = Date.now();
  const email = `wk3-${role}-${ts}@example.com`;
  const password = "WalkThrough2026!";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`create user: ${error?.message}`);
  const id = data.user.id;

  // Initial upsert (handles new profile)
  await admin.from("profiles").upsert(
    {
      id,
      display_name: role === "fan" ? "Walk Fan" : "Walk Creator",
      username: `wk_${role}_${ts}`,
      role,
      bio: role === "creator" ? "Creating exclusive content." : null,
      avatar_url: `https://ui-avatars.com/api/?name=Walk+${role === "creator" ? "Creator" : "Fan"}&background=7C3AED&color=fff&size=128`,
    },
    { onConflict: "id" }
  );

  // Explicit role update after 300ms — overrides any concurrent DB trigger
  // that might reset the role to "fan" on auth user creation.
  await new Promise((r) => setTimeout(r, 300));
  await admin.from("profiles").update({ role }).eq("id", id);

  console.log(`  ✅ Created ${role}: ${email}`);
  return { email, password, id };
}

async function deleteUser(id: string) {
  await admin.auth.admin.deleteUser(id).catch(() => {});
}

/**
 * Force-update the profile role after ensureProfile has run.
 * ensureProfile creates profiles with role="fan" on first auth.
 * This must be called after injectSession (warm-up) so ensureProfile runs first.
 */
async function forceProfileRole(userId: string, role: "fan" | "creator") {
  const { error } = await admin.from("profiles").update({ role }).eq("id", userId);
  if (error) {
    console.error(`  ❌ forceProfileRole failed: ${error.message}`);
    return false;
  }
  // Verify
  const { data } = await admin.from("profiles").select("role").eq("id", userId).maybeSingle();
  const confirmed = data?.role === role;
  console.log(`  🔑 Profile role = ${data?.role} (expected ${role}) ${confirmed ? "✅" : "❌"}`);
  return confirmed;
}

/**
 * Inject session by POSTing to /api/test/session from within the browser context.
 * This causes the server to set-cookie on the response, which Playwright captures.
 * After injection, warm-up by navigating to /home to prime the auth bootstrap cache.
 */
async function injectSession(ctx: BrowserContext, email: string, password: string) {
  // Pre-set age gate bypass cookie
  await ctx.addCookies([
    {
      name: "playwright-test-mode",
      value: "1",
      domain: "localhost",
      path: "/",
      httpOnly: false,
      secure: false,
    },
  ]);

  const page = await ctx.newPage();

  // Navigate to base URL first to establish origin
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });

  // Set age gate localStorage bypass
  await page.evaluate(() => {
    localStorage.setItem("getfansee_age_verified", "true");
  });

  const resp = await page.request.post(`${BASE_URL}/api/test/session`, {
    headers: { "Content-Type": "application/json" },
    data: { email, password },
  });

  if (!resp.ok()) {
    const body = await resp.text();
    console.error(`  ❌ Session inject failed: ${resp.status()} ${body}`);
    await page.close();
    return false;
  }

  // Warm-up: navigate to /home to prime auth bootstrap cache and confirm session works
  try {
    await page.goto(`${BASE_URL}/home`, { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForLoadState("networkidle", { timeout: 6000 }).catch(() => {});
    // Verify we're actually on home (not redirected to auth)
    const url = page.url();
    if (url.includes("/auth")) {
      console.error(`  ❌ Session warm-up redirected to auth for ${email}`);
      await page.close();
      return false;
    }
    console.log(`  ✅ Session verified on /home for ${email}`);
  } catch {
    // Warm-up failed but session might still work
    console.warn(`  ⚠️  Session warm-up timed out for ${email}`);
  }

  await page.close();
  return true;
}

// Pages that need extra wait for data to render
const CONTENT_WAIT_SELECTORS: Record<string, string> = {
  "/home": 'article, [data-testid="empty-state"], [data-testid="home-feed"]',
  "/me/wallet": '[data-testid="wallet-balance"], .glass-card, h2',
  "/notifications": 'h1, [data-testid="notification-item"], [data-testid="empty-state"]',
  "/search": 'h1, .creator-card, [data-testid="empty-state"]',
  "/me": 'h2, input[name="displayName"], [data-testid="page-ready"]',
  "/purchases": 'h1, [data-testid="empty-state"], .purchase-item',
  "/subscriptions": 'h1, [data-testid="empty-state"], .subscription-item',
  "/creator/studio": '.studio-layout, [data-testid="page-ready"], h1, .stat-card',
  "/creator/studio/analytics": 'h1, .stat-card, [data-testid="analytics-page"]',
  "/creator/studio/earnings": 'h1, [data-testid="earnings-page"], .card-block',
  "/creator/studio/post/list": 'h1, [data-testid="empty-state"], table, .post-list',
  "/creator/studio/subscribers": 'h1, [data-testid="empty-state"], .subscriber-item',
  "/creator/new-post": 'h1, form, textarea, [data-testid="new-post"]',
  "/creator/onboarding": "h1, form, input",
  "/creator/upgrade/kyc": 'h1, form, input, [data-testid="kyc-page"]',
  "/creator/upgrade": "h1, .card-block",
  "/posts/": 'article, h1, [data-testid="post-detail"], [data-testid="page-ready"]',
  "/creator/": 'h1, .profile-header, [data-testid="creator-profile"]',
};

async function shot(page: Page, url: string, filename: string) {
  const fullUrl = `${BASE_URL}${url}`;
  try {
    await page.goto(fullUrl, { waitUntil: "domcontentloaded", timeout: 25000 });
    // Wait for network to settle (catches Supabase auth/data fetches)
    // but don't block forever on WebSocket (realtime subscriptions)
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});

    // Bypass age gate via localStorage (in case it wasn't set before navigation)
    await page
      .evaluate(() => {
        try {
          localStorage.setItem("getfansee_age_verified", "true");
        } catch {}
      })
      .catch(() => {});

    // For data-heavy pages, wait for actual content element to appear
    // Use longest-prefix matching to handle dynamic routes like /posts/[id]
    const urlPath = url.split("?")[0];
    const contentSelector = Object.entries(CONTENT_WAIT_SELECTORS)
      .filter(([prefix]) => urlPath.startsWith(prefix))
      .sort((a, b) => b[0].length - a[0].length)[0]?.[1];

    if (contentSelector) {
      await page.waitForSelector(contentSelector, { timeout: 7000 }).catch(() => {});
    }

    // Final settle time for animations/skeleton-to-content transitions
    await page.waitForTimeout(2000);

    const filepath = path.join(OUT_DIR, filename);
    await page.screenshot({ path: filepath, fullPage: true });
    const cur = page.url();
    const urlSegment = url.split("?")[0].replace(/^\//, "");
    const redirected = urlSegment.length > 0 && !cur.includes(urlSegment.split("/")[0]);
    const icon = redirected ? "↩️ " : "✅";
    console.log(`  ${icon} ${filename.padEnd(40)} → ${cur.replace(BASE_URL, "")}`);
    return { ok: true, redirected };
  } catch (e) {
    console.error(`  ❌ ${filename}: ${e}`);
    return { ok: false, redirected: false };
  }
}

// ── Page list ─────────────────────────────────────────────────────────────────

const FAN_PAGES = [
  ["/auth", "auth"],
  ["/home", "home"],
  ["/search", "search"],
  ["/notifications", "notifications"],
  ["/me", "me"],
  ["/me/wallet", "me-wallet"],
  ["/subscriptions", "subscriptions"],
  ["/purchases", "purchases"],
  ["/creator/upgrade", "creator-upgrade"],
  ["/creator/upgrade/kyc", "creator-upgrade-kyc"],
  ["/terms", "terms"],
  ["/privacy", "privacy"],
  ["/dmca", "dmca"],
  ["/support", "support"],
] as const;

const CREATOR_PAGES = [
  ["/creator/studio", "creator-studio"],
  ["/creator/studio/analytics", "creator-analytics"],
  ["/creator/studio/earnings", "creator-earnings"],
  ["/creator/studio/post/list", "creator-post-list"],
  ["/creator/studio/subscribers", "creator-subscribers"],
  ["/creator/new-post", "creator-new-post"],
  ["/creator/onboarding", "creator-onboarding"],
] as const;

async function getWalkthroughTargets() {
  const { data: creators } = await admin.from("creators").select("id").limit(1);
  const { data: posts } = await admin
    .from("posts")
    .select("id")
    .eq("visibility", "free")
    .order("created_at", { ascending: false })
    .limit(1);

  return {
    creatorId: creators?.[0]?.id ?? null,
    postId: posts?.[0]?.id ?? null,
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🚀 GetFanSee UI Walkthrough v3");
  console.log("━".repeat(55));

  let fan: { email: string; password: string; id: string } | null = null;
  let creator: { email: string; password: string; id: string } | null = null;

  try {
    console.log("\n📦 Creating test users...");
    fan = await createUser("fan");
    creator = await createUser("creator");
    const targets = await getWalkthroughTargets();

    const browser = await chromium.launch({ headless: true });

    // ── MOBILE (375px) ────────────────────────────────────────────
    console.log("\n📱 Mobile (375×812) — Fan session");

    // Auth page FIRST without session (true logged-out look)
    const mbAnonCtx = await browser.newContext({
      viewport: { width: 375, height: 812 },
      deviceScaleFactor: 2,
    });
    const mbAnonPage = await mbAnonCtx.newPage();
    await shot(mbAnonPage, "/auth", "mb-auth.png");
    await mbAnonPage.close();
    await mbAnonCtx.close();

    const mbCtx = await browser.newContext({
      viewport: { width: 375, height: 812 },
      deviceScaleFactor: 2,
    });

    console.log("  🔐 Injecting fan session...");
    const mbFanOk = await injectSession(mbCtx, fan.email, fan.password);
    console.log(`  Session inject: ${mbFanOk ? "✅" : "❌"}`);

    const mbPage = await mbCtx.newPage();

    const fanPages = FAN_PAGES.filter(([, n]) => n !== "auth").map(
      ([url, name]) => [url, name] as const
    );
    if (targets.creatorId) {
      fanPages.push([`/creator/${targets.creatorId}`, "creator-profile"]);
    }
    if (targets.postId) {
      fanPages.push([`/posts/${targets.postId}`, "post-detail"]);
    }

    for (const [url, name] of fanPages) {
      await shot(mbPage, url, `mb-${name}.png`);
    }

    // Switch to creator session for creator pages
    await mbPage.close();
    await mbCtx.close();

    const mbCreatorCtx = await browser.newContext({
      viewport: { width: 375, height: 812 },
      deviceScaleFactor: 2,
    });
    console.log("\n  🔐 Injecting creator session for studio pages...");
    await injectSession(mbCreatorCtx, creator.email, creator.password);

    // Force creator role AFTER warm-up (ensureProfile may have reset it to fan)
    await forceProfileRole(creator.id, "creator");

    // Brief pause for DB change to propagate, then a fresh navigation to clear bootstrap cache
    await new Promise((r) => setTimeout(r, 500));

    const mbCreatorPage = await mbCreatorCtx.newPage();
    // Re-warm auth bootstrap with updated role
    await mbCreatorPage.goto(`${BASE_URL}/home`, { waitUntil: "domcontentloaded", timeout: 15000 });
    await mbCreatorPage.waitForLoadState("networkidle", { timeout: 6000 }).catch(() => {});
    await mbCreatorPage.waitForTimeout(1000);

    for (const [url, name] of CREATOR_PAGES) {
      await shot(mbCreatorPage, url, `mb-${name}.png`);
    }
    // Post detail with creator session (creator can always see their own posts)
    if (targets.postId) {
      await shot(mbCreatorPage, `/posts/${targets.postId}`, "mb-post-detail.png");
    }
    await mbCreatorCtx.close();

    // ── PC (1440px) ────────────────────────────────────────────────
    console.log("\n🖥️  PC (1440×900)");
    const pcCtx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
    });

    // Auth page (no session)
    const pcAnonPage = await pcCtx.newPage();
    await shot(pcAnonPage, "/auth", "pc-auth.png");
    await pcAnonPage.close();

    console.log("  🔐 Injecting creator session...");
    await injectSession(pcCtx, creator.email, creator.password);

    // Force creator role again (context may have re-triggered ensureProfile)
    await forceProfileRole(creator.id, "creator");
    await new Promise((r) => setTimeout(r, 500));

    const pcPage = await pcCtx.newPage();
    // Re-warm with correct creator role
    await pcPage.goto(`${BASE_URL}/home`, { waitUntil: "domcontentloaded", timeout: 15000 });
    await pcPage.waitForLoadState("networkidle", { timeout: 6000 }).catch(() => {});
    await pcPage.waitForTimeout(1000);
    const pcPages = [
      ["/home", "home"],
      ["/search", "search"],
      ["/notifications", "notifications"],
      ["/me", "me"],
      ["/me/wallet", "me-wallet"],
      ["/subscriptions", "subscriptions"],
      ["/purchases", "purchases"],
      ["/creator/upgrade", "creator-upgrade"],
      ["/creator/upgrade/kyc", "creator-upgrade-kyc"],
      ["/creator/studio", "creator-studio"],
      ["/creator/studio/analytics", "creator-analytics"],
      ["/creator/studio/earnings", "creator-earnings"],
      ["/creator/new-post", "creator-new-post"],
      ["/terms", "terms"],
      ["/privacy", "privacy"],
      ["/dmca", "dmca"],
    ] as const;

    const pcDynamicPages = [...pcPages];
    if (targets.creatorId) {
      pcDynamicPages.push([`/creator/${targets.creatorId}`, "creator-profile"]);
    }
    if (targets.postId) {
      // Use creator session so own posts always load
      pcDynamicPages.push([`/posts/${targets.postId}`, "post-detail"]);
    }

    for (const [url, name] of pcDynamicPages) {
      await shot(pcPage, url, `pc-${name}.png`);
    }

    // ── Modal State Screenshots ─────────────────────────────────────
    // Capture PaywallModal (subscribe) state by navigating to a post with
    // the paywall open.  We inject a hash that the page detects or we
    // programmatically trigger the modal open via JS.
    console.log("\n📸 Capturing modal states...");

    // Helper: open paywall-modal by navigating to a creator page and
    // clicking the Subscribe button (desktop).
    if (targets.creatorId) {
      try {
        await pcPage.goto(`${BASE_URL}/creator/${targets.creatorId}`, {
          waitUntil: "domcontentloaded",
          timeout: 20000,
        });
        await pcPage.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
        await pcPage.waitForTimeout(1500);

        // Find and click the "Subscribe" button (not own profile since this is creator session)
        // Use fan context instead
        const modalFanCtx = await browser.newContext({
          viewport: { width: 1440, height: 900 },
          deviceScaleFactor: 1,
        });
        await injectSession(modalFanCtx, fan.email, fan.password);
        const modalPage = await modalFanCtx.newPage();
        await modalPage.goto(`${BASE_URL}/creator/${targets.creatorId}`, {
          waitUntil: "domcontentloaded",
          timeout: 20000,
        });
        await modalPage.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
        await modalPage.waitForTimeout(1500);

        // Click the subscribe button to open the paywall modal
        const subBtn = modalPage.locator(
          '[data-testid="subscribe-button"], button:has-text("Subscribe")'
        );
        if ((await subBtn.count()) > 0) {
          await subBtn.first().click();
          await modalPage.waitForTimeout(1000);
          await modalPage.screenshot({
            path: path.join(OUT_DIR, "pc-paywall-subscribe.png"),
          });
          console.log("  ✅ pc-paywall-subscribe.png");
        }

        // Mobile paywall modal
        const mbModalCtx = await browser.newContext({
          viewport: { width: 375, height: 812 },
          deviceScaleFactor: 2,
        });
        await injectSession(mbModalCtx, fan.email, fan.password);
        const mbModalPage = await mbModalCtx.newPage();
        await mbModalPage.goto(`${BASE_URL}/creator/${targets.creatorId}`, {
          waitUntil: "domcontentloaded",
          timeout: 20000,
        });
        await mbModalPage.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
        await mbModalPage.waitForTimeout(1500);
        const mbSubBtn = mbModalPage.locator(
          '[data-testid="subscribe-button"], button:has-text("Subscribe")'
        );
        if ((await mbSubBtn.count()) > 0) {
          await mbSubBtn.first().click();
          await mbModalPage.waitForTimeout(1000);
          await mbModalPage.screenshot({
            path: path.join(OUT_DIR, "mb-paywall-subscribe.png"),
          });
          console.log("  ✅ mb-paywall-subscribe.png");
        }
        await mbModalPage.close();
        await mbModalCtx.close();

        await modalPage.close();
        await modalFanCtx.close();
      } catch (err) {
        console.warn(`  ⚠️  Modal screenshot failed: ${err}`);
      }
    }

    // Capture PPV paywall — navigate to a locked post and click unlock
    if (targets.postId) {
      try {
        const ppvFanCtx = await browser.newContext({
          viewport: { width: 1440, height: 900 },
          deviceScaleFactor: 1,
        });
        await injectSession(ppvFanCtx, fan.email, fan.password);
        const ppvPage = await ppvFanCtx.newPage();
        await ppvPage.goto(`${BASE_URL}/posts/${targets.postId}`, {
          waitUntil: "domcontentloaded",
          timeout: 20000,
        });
        await ppvPage.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
        await ppvPage.waitForTimeout(1500);

        // Try to click unlock button
        const unlockBtn = ppvPage.locator(
          '[data-testid="unlock-button"], button:has-text("Unlock")'
        );
        if ((await unlockBtn.count()) > 0) {
          await unlockBtn.first().click();
          await ppvPage.waitForTimeout(1000);
          await ppvPage.screenshot({
            path: path.join(OUT_DIR, "pc-paywall-ppv.png"),
          });
          console.log("  ✅ pc-paywall-ppv.png");
        }
        await ppvPage.close();
        await ppvFanCtx.close();
      } catch (err) {
        console.warn(`  ⚠️  PPV modal screenshot failed: ${err}`);
      }
    }

    // Capture "Add Funds" modal state from wallet page
    try {
      const walletFanCtx = await browser.newContext({
        viewport: { width: 375, height: 812 },
        deviceScaleFactor: 2,
      });
      await injectSession(walletFanCtx, fan.email, fan.password);
      const walletPage = await walletFanCtx.newPage();
      await walletPage.goto(`${BASE_URL}/me/wallet`, {
        waitUntil: "domcontentloaded",
        timeout: 20000,
      });
      await walletPage.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
      await walletPage.waitForTimeout(1500);

      const addFundsBtn = walletPage.locator(
        '[data-testid="add-funds-button"], button:has-text("Add Funds"), button:has-text("Top Up")'
      );
      if ((await addFundsBtn.count()) > 0) {
        await addFundsBtn.first().click();
        await walletPage.waitForTimeout(1000);
        await walletPage.screenshot({
          path: path.join(OUT_DIR, "mb-wallet-add-funds-modal.png"),
        });
        console.log("  ✅ mb-wallet-add-funds-modal.png");
      }
      await walletPage.close();
      await walletFanCtx.close();
    } catch (err) {
      console.warn(`  ⚠️  Add Funds modal screenshot failed: ${err}`);
    }

    // Locked post detail screenshot — mock-post-locked URL to show paywall state
    try {
      const lockedFanCtx = await browser.newContext({
        viewport: { width: 375, height: 812 },
        deviceScaleFactor: 2,
      });
      await injectSession(lockedFanCtx, fan.email, fan.password);
      const lockedPage = await lockedFanCtx.newPage();
      await lockedPage.goto(`${BASE_URL}/posts/mock-post-locked`, {
        waitUntil: "domcontentloaded",
        timeout: 20000,
      });
      await lockedPage.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
      await lockedPage.waitForTimeout(1500);
      await lockedPage.screenshot({
        path: path.join(OUT_DIR, "mb-post-detail-locked.png"),
      });
      console.log("  ✅ mb-post-detail-locked.png");
      await lockedPage.close();
      await lockedFanCtx.close();
    } catch (err) {
      console.warn(`  ⚠️  Locked post screenshot failed: ${err}`);
    }

    await pcCtx.close();
    await browser.close();

    // ── Report ─────────────────────────────────────────────────────
    const files = fs.readdirSync(OUT_DIR).filter((f) => f.endsWith(".png"));
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`✅ Walkthrough complete! ${files.length} screenshots in:`);
    console.log(`   ${OUT_DIR}`);
    console.log(`\nFiles:`);
    files.sort().forEach((f) => console.log(`  - ${f}`));
  } finally {
    console.log("\n🧹 Cleaning up...");
    if (fan) await deleteUser(fan.id);
    if (creator) await deleteUser(creator.id);
    console.log("Done.");
  }
}

main().catch(console.error);
