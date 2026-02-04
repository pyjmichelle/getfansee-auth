/**
 * E2E Tests: Atomic PPV Unlock with Idempotency
 *
 * Tests the new unlock_ppv RPC function for:
 * 1. Successful unlock with balance deduction
 * 2. Idempotency (double-click prevention)
 * 3. Insufficient balance handling
 */

import { test, expect } from "@playwright/test";
import {
  clearStorage,
  createConfirmedTestUser,
  deleteTestUser,
  emitE2EDiagnostics,
  expectUnlockedByServer,
  fetchAuthedJson,
  injectSupabaseSession,
  safeClick,
  waitForPageLoad,
} from "./shared/helpers";
import {
  setupTestFixtures,
  teardownTestFixtures,
  topUpWallet,
  type TestFixtures,
} from "./shared/fixtures";

// Test fixtures
const TEST_PASSWORD = "TestPassword123!";
const PPV_PRICE = 5.0;
const INITIAL_BALANCE = 10.0;
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";

test.describe("Atomic PPV Unlock Tests", () => {
  let fixtures: TestFixtures;
  const createdUserIds: string[] = [];

  test.beforeAll(async () => {
    fixtures = await setupTestFixtures();
  });

  test.afterAll(async () => {
    await teardownTestFixtures(fixtures);
    for (const userId of createdUserIds) {
      await deleteTestUser(userId);
    }
  });

  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status !== "passed") {
      await emitE2EDiagnostics(page, testInfo);
    }
  });

  test("E2E-1: PPV unlock success → purchase+transactions consistency", async ({ page }) => {
    await injectSupabaseSession(page, fixtures.fan.email, fixtures.fan.password, BASE_URL);
    await waitForPageLoad(page);

    await page.goto(`${BASE_URL}/posts/${fixtures.posts.ppv.id}`);
    await waitForPageLoad(page);
    // 等待帖子页面加载，检查是否有错误
    const postPageOrError = page.getByTestId("post-page").or(page.getByTestId("post-page-error"));
    await expect(postPageOrError).toBeVisible({ timeout: 20_000 });
    if (
      await page
        .getByTestId("post-page-error")
        .isVisible()
        .catch(() => false)
    ) {
      throw new Error(
        `Post page error: fixtures.posts.ppv (${fixtures.posts.ppv.id}) failed to load`
      );
    }

    const unlockBtn = page.getByTestId("post-unlock-button");
    await expect(unlockBtn).toBeVisible({ timeout: 20_000 });
    await unlockBtn.scrollIntoViewIfNeeded();
    await unlockBtn.click();

    await expect(page.getByTestId("paywall-modal")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("paywall-price")).toHaveText(`$${PPV_PRICE.toFixed(2)}`);

    await safeClick(page.getByTestId("paywall-unlock-button"), { timeout: 20_000 });

    // 主断言：server state（轮询 /api/purchases + UI 辅证），不依赖 paywall-success-message
    await expectUnlockedByServer(page, {
      postId: fixtures.posts.ppv.id,
      price: PPV_PRICE,
    });

    const contentElement = page.locator('[data-testid="post-content"]').first();
    await expect(contentElement).toBeVisible();
  });

  test("E2E-2: Double-click unlock → single charge (idempotency)", async ({ page }) => {
    const fanAccount = await createConfirmedTestUser("fan");
    createdUserIds.push(fanAccount.userId);
    await topUpWallet(fanAccount.userId, Math.round(INITIAL_BALANCE * 100));

    await injectSupabaseSession(page, fanAccount.email, fanAccount.password, BASE_URL);
    await waitForPageLoad(page);

    await page.goto(`${BASE_URL}/posts/${fixtures.posts.ppv.id}`);
    await waitForPageLoad(page);
    // 等待帖子页面加载，检查是否有错误
    const postPageOrError = page.getByTestId("post-page").or(page.getByTestId("post-page-error"));
    await expect(postPageOrError).toBeVisible({ timeout: 20_000 });
    if (
      await page
        .getByTestId("post-page-error")
        .isVisible()
        .catch(() => false)
    ) {
      throw new Error(
        `Post page error: fixtures.posts.ppv (${fixtures.posts.ppv.id}) failed to load`
      );
    }

    const preUrl = page.url();
    if (preUrl.includes("/auth")) {
      const bodyText = await page
        .locator("body")
        .textContent()
        .catch(() => "");
      throw new Error(
        `E2E-2 pre-assert: URL contains /auth. url=${preUrl} body(200)=${bodyText.slice(0, 200)}`
      );
    }

    const unlockBtn = page.getByTestId("post-unlock-button");
    await expect(unlockBtn).toBeVisible({ timeout: 20_000 });
    await unlockBtn.scrollIntoViewIfNeeded();
    await unlockBtn.click();
    await expect(page.getByTestId("paywall-modal")).toBeVisible({ timeout: 15_000 });

    // 等余额出现后读 initial（轮询，不加 sleep），必须在第一次 click 前拿到
    let initialBalance = 0;
    await expect
      .poll(
        async () => {
          const text = await page
            .getByTestId("paywall-balance-value")
            .first()
            .textContent()
            .catch(() => null);
          const match = text?.match(/\$(\d+\.\d+)/);
          if (match) {
            initialBalance = parseFloat(match[1]);
            return true;
          }
          return false;
        },
        { timeout: 25_000, intervals: [500, 1000] }
      )
      .toBe(true);

    const unlockButton = page.getByTestId("paywall-unlock-button").first();
    await expect(unlockButton).toBeVisible({ timeout: 20_000 });
    await expect(unlockButton).toBeEnabled({ timeout: 10_000 });
    await unlockButton.scrollIntoViewIfNeeded();

    // 两次顺序 click（禁止 Promise.all 并发），第二次可能被拦/失败
    await unlockButton.click();
    await unlockButton.click().catch(() => {});

    // 主断言：server state 购买仅 1 条 + 余额只扣一次，不依赖 paywall-success-message
    await expectUnlockedByServer(page, {
      postId: fixtures.posts.ppv.id,
      price: PPV_PRICE,
      initialBalance,
    });
  });

  test("E2E-3: Insufficient balance → no purchase, no transactions, UI prompts recharge", async ({
    page,
  }) => {
    const fanAccount = await createConfirmedTestUser("fan");
    createdUserIds.push(fanAccount.userId);

    await injectSupabaseSession(page, fanAccount.email, fanAccount.password, BASE_URL);
    await waitForPageLoad(page);

    // Verify $0 balance
    await page.goto("/me/wallet");
    await expect(page.getByTestId("wallet-balance-value")).toHaveText("$0.00");

    // 3. Try to unlock PPV post
    await page.goto(`${BASE_URL}/posts/${fixtures.posts.ppv.id}`);
    await waitForPageLoad(page);
    const unlockBtn = page.getByTestId("post-unlock-button");
    await expect(unlockBtn).toBeVisible({ timeout: 20_000 });
    await unlockBtn.click();

    // Wait for paywall modal（.first() 避免 strict 多元素）
    await expect(page.getByTestId("paywall-modal").first()).toBeVisible({ timeout: 15_000 });

    await expect(page.getByTestId("paywall-balance-value").first()).toContainText("$0.00");

    // Should show "Add Funds" button instead of "Unlock" button
    await expect(page.getByTestId("paywall-add-funds-link")).toBeVisible();

    // Click "Add Funds" should redirect to wallet
    await page.getByTestId("paywall-add-funds-link").click();
    await expect(page).toHaveURL(/\/me\/wallet/);

    // 4. Verify no purchase was created
    const purchasesRes = await fetchAuthedJson(page, "/api/purchases");
    if (!purchasesRes.ok) {
      throw new Error(
        `/api/purchases failed: status=${purchasesRes.status} body=${JSON.stringify(purchasesRes.body)}`
      );
    }
    const purchasesData = Array.isArray((purchasesRes.body as { data?: unknown[] })?.data)
      ? (purchasesRes.body as { data: unknown[] }).data
      : [];
    expect(purchasesData).toHaveLength(0);

    // 5. Verify no transactions were created
    const txRes = await fetchAuthedJson(page, "/api/transactions");
    if (!txRes.ok) {
      throw new Error(
        `/api/transactions failed: status=${txRes.status} body=${JSON.stringify(txRes.body)}`
      );
    }
    const txData = Array.isArray((txRes.body as { data?: unknown[] })?.data)
      ? (txRes.body as { data: unknown[] }).data
      : [];
    expect(txData).toHaveLength(0);
  });
});
