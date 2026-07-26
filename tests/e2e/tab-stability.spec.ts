/**
 * Tab / segment stability assertions — UI 体验根治三次审查修订「验收断言」.
 *
 * Existing gates (`qa:gate`) only check selectors + dead clicks; nothing in
 * `tests/` asserted layout-shift-on-tab-switch, so the whole class of bugs
 * fixed in batches 3/3.5/5/6 (scrollbar-gutter, TabsContent unmount/remount,
 * skeleton-height mismatch, active/inactive border+font-weight asymmetry,
 * 44px touch targets) had zero regression coverage. This file adds the four
 * assertion types called for by the plan:
 *
 *   1. Jump assertion   — nav/header boundingBox() must not move when a tab
 *                         switches (pixel-identical before/after).
 *   2. Touch assertion  — every tab hit box is >= 44px tall on mobile.
 *   3. CLS assertion    — PerformanceObserver layout-shift sum during a tab
 *                         switch stays under 0.02.
 *   4. Box-model parity — active/inactive tab states must have identical
 *                         border-width/font-weight/height (only color may
 *                         differ) — see the note above that test for why
 *                         this replaces a pixel `toHaveScreenshot()`.
 *
 * Spot-checked across the four surfaces named in the plan: Home, /me,
 * Creator Studio Analytics, and a public creator profile page.
 *
 * Run all:  pnpm exec playwright test tests/e2e/tab-stability.spec.ts --project=chromium
 */

import { test, expect, type Page, type Locator } from "@playwright/test";
import { createConfirmedTestUser, deleteTestUser, injectSupabaseSession } from "./shared/helpers";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";
const MOBILE_VIEWPORT = { width: 390, height: 844 }; // iPhone 14 Pro
const MOCK_CREATOR_ID = "mock-creator-1"; // falls back to mock data — no DB seed needed

const MAX_CLS_ON_TAB_SWITCH = 0.02;
const MIN_TOUCH_TARGET_PX = 44;

/**
 * Start a PerformanceObserver('layout-shift') accumulator scoped to a single
 * chrome element (nav bar / tab strip / sticky header). Whole-page CLS is the
 * wrong signal here: switching "For You"/"Following" or Posts/About
 * legitimately swaps in a different amount of feed/post content below the
 * fold, and that expected reflow would otherwise swamp the metric we
 * actually care about — whether the tab bar / nav *itself* jumps (the bug
 * class this test targets: scrollbar-gutter, TabsContent remount, skeleton
 * height mismatch, border/font-weight asymmetry). The layout-shift API's
 * `sources[].node` lets us filter to only shifts whose source overlaps the
 * target element.
 */
async function startScopedClsObserver(locator: Locator) {
  await locator.evaluate((el) => {
    (window as unknown as { __clsSum: number }).__clsSum = 0;
    const target = el;
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as unknown as Array<{
        value: number;
        sources?: Array<{ node?: Node }>;
      }>) {
        const sources = entry.sources ?? [];
        // Only count a shift if its source node is the target itself or
        // nested inside it — NOT the reverse (`node.contains(target)`),
        // which would match nearly every page-wide shift since <body>/<html>
        // always "contain" any chrome element, defeating the whole point of
        // scoping. Browsers sometimes report an ancestor as the source when
        // they can't attribute precisely (e.g. font load reflow) — those are
        // exactly the page-wide/content shifts we want to exclude here.
        const affectsTarget = sources.some((s) => s.node && target.contains(s.node));
        if (affectsTarget) {
          (window as unknown as { __clsSum: number }).__clsSum += entry.value;
        }
      }
    });
    observer.observe({ type: "layout-shift", buffered: true });
  });
}

async function readClsSum(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as { __clsSum?: number }).__clsSum ?? 0);
}

test.describe("Tab stability — jump / touch / CLS / visual", () => {
  // ───────────────────────────────────────────────────────────────────────
  // 1. Home feed tabs (For You / Following) — PC + mobile boundingBox + CLS
  // ───────────────────────────────────────────────────────────────────────
  test.describe("Home — For You / Following", () => {
    let userId = "";
    let email = "";
    let password = "";

    test.beforeAll(async () => {
      const fan = await createConfirmedTestUser("fan");
      userId = fan.userId;
      email = fan.email;
      password = fan.password;
    });

    test.afterAll(async () => {
      if (userId) await deleteTestUser(userId);
    });

    test("nav header does not move when switching feed tabs (PC)", async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await injectSupabaseSession(page, email, password, BASE_URL);
      await page.getByTestId("home-feed").waitFor({ state: "visible", timeout: 15_000 });

      const followingTab = page.getByRole("button", { name: "Following" });
      const forYouTab = page.getByRole("button", { name: "For You" });
      await followingTab.waitFor({ state: "visible", timeout: 10_000 });

      const nav = page.locator("nav").first();
      const before = await nav.boundingBox();
      expect(before, "nav must be present before tab switch").not.toBeNull();

      await startScopedClsObserver(nav);
      await followingTab.click();
      await page.waitForTimeout(300); // let any reflow / transition settle
      await forYouTab.click();
      await page.waitForTimeout(300);

      const after = await nav.boundingBox();
      expect(after, "nav must be present after tab switch").not.toBeNull();
      expect(after!.y).toBeCloseTo(before!.y, 0);
      expect(after!.x).toBeCloseTo(before!.x, 0);
      expect(after!.width).toBeCloseTo(before!.width, 0);

      const cls = await readClsSum(page);
      expect(cls, "cumulative layout shift during tab switch").toBeLessThan(MAX_CLS_ON_TAB_SWITCH);
    });

    test("feed tab hit box is >= 44px tall on mobile", async ({ page }) => {
      await page.setViewportSize(MOBILE_VIEWPORT);
      await injectSupabaseSession(page, email, password, BASE_URL);
      await page.getByTestId("home-feed").waitFor({ state: "visible", timeout: 15_000 });

      const forYouTab = page.getByRole("button", { name: "For You" });
      await forYouTab.waitFor({ state: "visible", timeout: 10_000 });
      const box = await forYouTab.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX);
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // 2. /me settings tabs (mobile-only Radix Tabs — desktop uses a sidebar)
  // ───────────────────────────────────────────────────────────────────────
  test.describe("/me — settings tabs (mobile)", () => {
    let userId = "";
    let email = "";
    let password = "";

    test.beforeAll(async () => {
      const fan = await createConfirmedTestUser("fan");
      userId = fan.userId;
      email = fan.email;
      password = fan.password;
    });

    test.afterAll(async () => {
      if (userId) await deleteTestUser(userId);
    });

    test("settings tab hit boxes are >= 44px tall and profile banner does not shift", async ({
      page,
    }) => {
      await page.setViewportSize(MOBILE_VIEWPORT);
      await injectSupabaseSession(page, email, password, BASE_URL);
      await page.goto(`${BASE_URL}/me`, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.getByTestId("me-page-ready").waitFor({ state: "visible", timeout: 15_000 });

      const tablist = page.getByRole("tablist");
      await tablist.waitFor({ state: "visible", timeout: 10_000 });
      const tabs = page.getByRole("tab");
      const tabCount = await tabs.count();
      expect(tabCount).toBeGreaterThan(0);
      for (let i = 0; i < tabCount; i++) {
        const box = await tabs.nth(i).boundingBox();
        expect(box, `tab #${i} must have a bounding box`).not.toBeNull();
        expect(
          box!.height,
          `tab #${i} hit box height must be >= ${MIN_TOUCH_TARGET_PX}px`
        ).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX);
      }

      const savedTab = page.getByRole("tab", { name: "Saved" });
      const profileTab = page.getByRole("tab", { name: "Profile" });
      const banner = page.getByTestId("me-page-ready").locator("> *").first();
      const before = await banner.boundingBox();

      await startScopedClsObserver(banner);
      await savedTab.click();
      await page.waitForTimeout(300);
      await profileTab.click();
      await page.waitForTimeout(300);

      const after = await banner.boundingBox();
      expect(before).not.toBeNull();
      expect(after).not.toBeNull();
      expect(after!.y).toBeCloseTo(before!.y, 0);

      const cls = await readClsSum(page);
      expect(cls).toBeLessThan(MAX_CLS_ON_TAB_SWITCH);
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // 3. Public creator profile — Posts / About tabs
  // ───────────────────────────────────────────────────────────────────────
  test.describe("Creator profile — Posts / About", () => {
    let userId = "";
    let email = "";
    let password = "";

    test.beforeAll(async () => {
      const fan = await createConfirmedTestUser("fan");
      userId = fan.userId;
      email = fan.email;
      password = fan.password;
    });

    test.afterAll(async () => {
      if (userId) await deleteTestUser(userId);
    });

    async function gotoMockCreator(page: Page, viewport: { width: number; height: number }) {
      await page.setViewportSize(viewport);
      await injectSupabaseSession(page, email, password, BASE_URL);
      await page.goto(`${BASE_URL}/creator/${MOCK_CREATOR_ID}`, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      await page.getByRole("tablist").waitFor({ state: "visible", timeout: 20_000 });
    }

    test("Posts/About tab hit boxes are >= 44px tall on mobile", async ({ page }) => {
      await gotoMockCreator(page, MOBILE_VIEWPORT);
      const tabs = page.getByRole("tab");
      const count = await tabs.count();
      expect(count).toBeGreaterThanOrEqual(2);
      for (let i = 0; i < count; i++) {
        const box = await tabs.nth(i).boundingBox();
        expect(box).not.toBeNull();
        expect(box!.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX);
      }
    });

    test("switching Posts/About does not move the tab bar itself (PC)", async ({ page }) => {
      await gotoMockCreator(page, { width: 1280, height: 900 });

      const tablist = page.getByRole("tablist");
      const before = await tablist.boundingBox();
      expect(before).not.toBeNull();

      await startScopedClsObserver(tablist);
      await page.getByRole("tab", { name: "About" }).click();
      await page.waitForTimeout(300);
      await page.getByRole("tab", { name: "Posts" }).click();
      await page.waitForTimeout(300);

      const after = await tablist.boundingBox();
      expect(after).not.toBeNull();
      expect(after!.y).toBeCloseTo(before!.y, 0);
      expect(after!.x).toBeCloseTo(before!.x, 0);

      const cls = await readClsSum(page);
      expect(cls).toBeLessThan(MAX_CLS_ON_TAB_SWITCH);
    });

    // A pixel `toHaveScreenshot()` baseline generated on this (macOS/darwin)
    // dev machine would never match the Linux runner CI actually diffs
    // against (Playwright's snapshot filenames are platform-suffixed), so a
    // freshly-committed darwin baseline would hard-fail the very first CI
    // run with "snapshot doesn't exist" — no Linux/Docker environment is
    // available here to generate the matching baseline. Instead, assert the
    // exact CSS properties the original regression broke (batch 3.5: active
    // state used to drop the border entirely and add font-weight, both of
    // which resize the tab and shift neighboring layout) — deterministic
    // across OS/font-rendering, unlike a pixel diff, and a more precise
    // regression guard for "did the box model change" than a screenshot is.
    test("active/inactive tabs never differ in border-width or font-weight", async ({ page }) => {
      await gotoMockCreator(page, { width: 1280, height: 900 });

      const postsTab = page.getByRole("tab", { name: "Posts" });
      const aboutTab = page.getByRole("tab", { name: "About" });

      async function readBoxMetrics(locator: Locator) {
        return locator.evaluate((el) => {
          const style = getComputedStyle(el);
          return {
            borderBottomWidth: style.borderBottomWidth,
            fontWeight: style.fontWeight,
            height: el.getBoundingClientRect().height,
          };
        });
      }

      const postsActiveMetrics = await readBoxMetrics(postsTab);
      const aboutInactiveMetrics = await readBoxMetrics(aboutTab);

      await aboutTab.click();
      await page.waitForTimeout(200);

      const postsInactiveMetrics = await readBoxMetrics(postsTab);
      const aboutActiveMetrics = await readBoxMetrics(aboutTab);

      // Same tab, active vs inactive: border-width, font-weight, and height
      // must be pixel-identical — only color may change.
      expect(postsInactiveMetrics.borderBottomWidth).toBe(postsActiveMetrics.borderBottomWidth);
      expect(postsInactiveMetrics.fontWeight).toBe(postsActiveMetrics.fontWeight);
      expect(postsInactiveMetrics.height).toBeCloseTo(postsActiveMetrics.height, 0);

      expect(aboutActiveMetrics.borderBottomWidth).toBe(aboutInactiveMetrics.borderBottomWidth);
      expect(aboutActiveMetrics.fontWeight).toBe(aboutInactiveMetrics.fontWeight);
      expect(aboutActiveMetrics.height).toBeCloseTo(aboutInactiveMetrics.height, 0);
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // 4. Creator Studio Analytics — time range selector (7d/30d/90d)
  // ───────────────────────────────────────────────────────────────────────
  test.describe("Studio Analytics — time range selector", () => {
    let creatorId = "";
    let email = "";
    let password = "";

    test.beforeAll(async () => {
      const creator = await createConfirmedTestUser("creator");
      creatorId = creator.userId;
      email = creator.email;
      password = creator.password;
    });

    test.afterAll(async () => {
      if (creatorId) await deleteTestUser(creatorId);
    });

    test("time range hit boxes are >= 44px and header does not move on switch", async ({
      page,
    }) => {
      await page.setViewportSize(MOBILE_VIEWPORT);
      await injectSupabaseSession(page, email, password, BASE_URL);
      await page.goto(`${BASE_URL}/creator/studio/analytics`, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      await page.getByTestId("analytics-ready").waitFor({ state: "visible", timeout: 20_000 });

      const sevenDay = page.getByRole("button", { name: "7 Days" });
      const thirtyDay = page.getByRole("button", { name: "30 Days" });
      await sevenDay.waitFor({ state: "visible", timeout: 10_000 });

      const box7 = await sevenDay.boundingBox();
      const box30 = await thirtyDay.boundingBox();
      expect(box7).not.toBeNull();
      expect(box30).not.toBeNull();
      expect(box7!.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX);
      expect(box30!.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX);

      const header = page.getByTestId("analytics-header");
      const before = await header.boundingBox();

      await startScopedClsObserver(header);
      await sevenDay.click();
      await page.waitForTimeout(300);
      await thirtyDay.click();
      await page.waitForTimeout(300);

      const after = await header.boundingBox();
      expect(before).not.toBeNull();
      expect(after).not.toBeNull();
      expect(after!.x).toBeCloseTo(before!.x, 0);

      const cls = await readClsSum(page);
      expect(cls).toBeLessThan(MAX_CLS_ON_TAB_SWITCH);
    });
  });
});
