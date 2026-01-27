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
  injectSupabaseSession,
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
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";

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

  test("E2E-1: PPV unlock success → purchase+transactions consistency", async ({ page }) => {
    await injectSupabaseSession(page, fixtures.fan.email, fixtures.fan.password, BASE_URL);
    await waitForPageLoad(page);

    // Navigate to PPV post
    await page.goto(`${BASE_URL}/posts/${fixtures.posts.ppv.id}`);
    await waitForPageLoad(page);

    // 4. Click unlock button
    await page.getByTestId("post-unlock-button").click();

    // Wait for paywall modal
    await expect(page.getByTestId("paywall-modal")).toBeVisible();

    // Verify price displayed
    await expect(page.getByTestId("paywall-price")).toHaveText(`$${PPV_PRICE.toFixed(2)}`);

    // Click unlock payment button
    await page.getByTestId("paywall-unlock-button").click();

    // Wait for success state
    await expect(page.getByTestId("paywall-success-message")).toBeVisible({ timeout: 10000 });

    // 5. Verify content is unlocked immediately
    await page.waitForTimeout(2000); // Wait for modal to close

    // Content should be visible (not blurred)
    const contentElement = page.locator('[data-testid="post-content"]').first();
    await expect(contentElement).toBeVisible();

    // 6. Verify database consistency (via API)
    const response = await page.request.get("/api/purchases");
    const purchases = await response.json();

    // Should have exactly 1 purchase
    expect(purchases.data).toHaveLength(1);
    expect(purchases.data[0].post_id).toBe(fixtures.posts.ppv.id);
    expect(purchases.data[0].amount).toBe(PPV_PRICE);

    // Verify transaction exists
    const txResponse = await page.request.get("/api/transactions");
    const transactions = await txResponse.json();

    // Should have 2 transactions: fan debit + creator credit
    const relatedTx = transactions.data.filter((tx: any) => tx.related_id === purchases.data[0].id);
    expect(relatedTx).toHaveLength(2);

    // Verify fan debit
    const fanDebit = relatedTx.find((tx: any) => tx.amount < 0);
    expect(fanDebit).toBeDefined();
    expect(fanDebit.amount).toBe(-PPV_PRICE);

    // Verify creator credit
    const creatorCredit = relatedTx.find((tx: any) => tx.amount > 0);
    expect(creatorCredit).toBeDefined();
    expect(creatorCredit.amount).toBe(PPV_PRICE);
  });

  test("E2E-2: Double-click unlock → single charge (idempotency)", async ({ page }) => {
    const fanAccount = await createConfirmedTestUser("fan");
    createdUserIds.push(fanAccount.userId);
    await topUpWallet(fanAccount.userId, Math.round(INITIAL_BALANCE * 100));

    await injectSupabaseSession(page, fanAccount.email, fanAccount.password, BASE_URL);
    await waitForPageLoad(page);

    // Navigate to PPV post
    await page.goto(`${BASE_URL}/posts/${fixtures.posts.ppv.id}`);
    await waitForPageLoad(page);

    // Click unlock button
    await page.getByTestId("post-unlock-button").click();
    await expect(page.getByTestId("paywall-modal")).toBeVisible();

    // Get initial balance
    const balanceText = await page.getByTestId("paywall-balance-value").textContent();
    const initialBalance = parseFloat(balanceText?.match(/\$(\d+\.\d+)/)?.[1] || "0");

    // Click unlock button rapidly (simulate double-click)
    const unlockButton = page.getByTestId("paywall-unlock-button");
    await Promise.all([unlockButton.click(), unlockButton.click(), unlockButton.click()]);

    // Wait for success
    await expect(page.getByTestId("paywall-success-message")).toBeVisible({ timeout: 10000 });

    // Verify only charged once
    await page.waitForTimeout(2000);
    await page.goto("/me/wallet");

    const finalBalanceText = await page.getByTestId("wallet-balance-value").textContent();
    const finalBalance = parseFloat(finalBalanceText?.match(/\$(\d+\.\d+)/)?.[1] || "0");

    // Should be charged exactly once
    expect(finalBalance).toBe(initialBalance - PPV_PRICE);

    // Verify only 1 purchase record
    const response = await page.request.get("/api/purchases");
    const purchases = await response.json();

    // Should have exactly 1 purchase (idempotency worked)
    expect(purchases.data || []).toHaveLength(1);
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
    await page.getByTestId("post-unlock-button").click();

    // Wait for paywall modal
    await expect(page.getByTestId("paywall-modal")).toBeVisible();

    // Should show insufficient balance warning
    await expect(page.getByTestId("paywall-balance-value")).toHaveText(/\\$0\\.00/);

    // Should show "Add Funds" button instead of "Unlock" button
    await expect(page.getByTestId("paywall-add-funds-link")).toBeVisible();

    // Click "Add Funds" should redirect to wallet
    await page.getByTestId("paywall-add-funds-link").click();
    await expect(page).toHaveURL(/\/me\/wallet/);

    // 4. Verify no purchase was created
    const response = await page.request.get("/api/purchases");
    const purchases = await response.json();
    expect(purchases.data || []).toHaveLength(0);

    // 5. Verify no transactions were created
    const txResponse = await page.request.get("/api/transactions");
    const transactions = await txResponse.json();
    expect(transactions.data || []).toHaveLength(0);
  });
});
