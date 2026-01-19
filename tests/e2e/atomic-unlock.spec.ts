/**
 * E2E Tests: Atomic PPV Unlock with Idempotency
 *
 * Tests the new unlock_ppv RPC function for:
 * 1. Successful unlock with balance deduction
 * 2. Idempotency (double-click prevention)
 * 3. Insufficient balance handling
 */

import { test, expect } from "@playwright/test";

// Test fixtures
const TEST_FAN_EMAIL = `e2e-atomic-fan-${Date.now()}@test.com`;
const TEST_CREATOR_EMAIL = `e2e-atomic-creator-${Date.now()}@test.com`;
const TEST_PASSWORD = "TestPassword123!";
const PPV_PRICE = 5.0;
const INITIAL_BALANCE = 10.0;

test.describe("Atomic PPV Unlock Tests", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to auth page
    await page.goto("/auth");
  });

  test("E2E-1: PPV unlock success → purchase+transactions consistency", async ({ page }) => {
    // 1. Register and setup Creator
    await page.getByRole("tab", { name: /sign up/i }).click();
    await page.getByPlaceholder("Email").fill(TEST_CREATOR_EMAIL);
    await page.getByPlaceholder("Password").first().fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /sign up/i }).click();

    await page.waitForURL("/home", { timeout: 10000 });

    // Become creator
    await page.goto("/creator/upgrade");
    await page.getByPlaceholder("Display Name").fill("Test Creator");
    await page.getByPlaceholder("Bio").fill("Test creator for atomic unlock");
    await page.getByRole("button", { name: /continue/i }).click();

    await page.waitForURL(/\/creator\/studio/, { timeout: 10000 });

    // Create PPV post
    await page.goto("/creator/new-post");
    await page.getByPlaceholder("Title").fill("Atomic Test PPV Post");
    await page.getByPlaceholder("Content").fill("This is a test PPV post for atomic unlock");

    // Set as PPV with price
    await page.getByLabel(/visibility/i).selectOption("ppv");
    await page.getByPlaceholder("Price").fill(PPV_PRICE.toString());

    await page.getByRole("button", { name: /publish/i }).click();
    await page.waitForURL("/home", { timeout: 10000 });

    // Get post ID from URL or page
    const postUrl = page.url();
    const postId = postUrl.match(/\/posts\/([a-f0-9-]+)/)?.[1];

    // Logout
    await page.goto("/auth");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // 2. Register Fan and add balance
    await page.goto("/auth");
    await page.getByRole("tab", { name: /sign up/i }).click();
    await page.getByPlaceholder("Email").fill(TEST_FAN_EMAIL);
    await page.getByPlaceholder("Password").first().fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /sign up/i }).click();

    await page.waitForURL("/home", { timeout: 10000 });

    // Add balance to wallet (simulate)
    await page.goto("/me/wallet");
    // Note: In real test, would need to call recharge API
    // For now, assume wallet has balance

    // 3. Navigate to PPV post
    await page.goto("/home");
    await page.getByText("Atomic Test PPV Post").first().click();

    // 4. Click unlock button
    await page.getByRole("button", { name: /unlock/i }).click();

    // Wait for paywall modal
    await expect(page.getByText(/unlock this content/i)).toBeVisible();

    // Verify price displayed
    await expect(page.getByText(`$${PPV_PRICE.toFixed(2)}`)).toBeVisible();

    // Click unlock payment button
    await page.getByRole("button", { name: /unlock for/i }).click();

    // Wait for success state
    await expect(page.getByText(/payment successful/i)).toBeVisible({ timeout: 10000 });

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
    expect(purchases.data[0].post_id).toBe(postId);
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
    // Setup: Create creator with PPV post (reuse from test 1 or create new)
    // ... (similar setup as test 1)

    // Navigate to PPV post
    await page.goto("/home");
    // ... find PPV post

    // Click unlock button
    await page.getByRole("button", { name: /unlock/i }).click();
    await expect(page.getByText(/unlock this content/i)).toBeVisible();

    // Get initial balance
    const balanceText = await page.getByText(/current balance/i).textContent();
    const initialBalance = parseFloat(balanceText?.match(/\$(\d+\.\d+)/)?.[1] || "0");

    // Click unlock button rapidly (simulate double-click)
    const unlockButton = page.getByRole("button", { name: /unlock for/i });
    await Promise.all([unlockButton.click(), unlockButton.click(), unlockButton.click()]);

    // Wait for success
    await expect(page.getByText(/payment successful/i)).toBeVisible({ timeout: 10000 });

    // Verify only charged once
    await page.waitForTimeout(2000);
    await page.goto("/me/wallet");

    const finalBalanceText = await page.getByText(/balance/i).textContent();
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
    // 1. Setup: Create creator with PPV post priced at $10
    await page.goto("/auth");
    await page.getByRole("tab", { name: /sign up/i }).click();
    await page.getByPlaceholder("Email").fill(`creator-${Date.now()}@test.com`);
    await page.getByPlaceholder("Password").first().fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /sign up/i }).click();

    await page.waitForURL("/home", { timeout: 10000 });

    // Become creator and create $10 PPV post
    await page.goto("/creator/upgrade");
    await page.getByPlaceholder("Display Name").fill("Expensive Creator");
    await page.getByRole("button", { name: /continue/i }).click();

    await page.goto("/creator/new-post");
    await page.getByPlaceholder("Title").fill("Expensive PPV Post");
    await page.getByLabel(/visibility/i).selectOption("ppv");
    await page.getByPlaceholder("Price").fill("10.00");
    await page.getByRole("button", { name: /publish/i }).click();

    // Logout
    await page.goto("/auth");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // 2. Register Fan with $0 balance
    await page.goto("/auth");
    await page.getByRole("tab", { name: /sign up/i }).click();
    await page.getByPlaceholder("Email").fill(`fan-broke-${Date.now()}@test.com`);
    await page.getByPlaceholder("Password").first().fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /sign up/i }).click();

    await page.waitForURL("/home", { timeout: 10000 });

    // Verify $0 balance
    await page.goto("/me/wallet");
    await expect(page.getByText(/\$0\.00/)).toBeVisible();

    // 3. Try to unlock expensive post
    await page.goto("/home");
    await page.getByText("Expensive PPV Post").first().click();
    await page.getByRole("button", { name: /unlock/i }).click();

    // Wait for paywall modal
    await expect(page.getByText(/unlock this content/i)).toBeVisible();

    // Should show insufficient balance warning
    await expect(page.getByText(/current balance.*\$0\.00/i)).toBeVisible();

    // Should show "Add Funds" button instead of "Unlock" button
    await expect(page.getByRole("button", { name: /add funds/i })).toBeVisible();

    // Click "Add Funds" should redirect to wallet
    await page.getByRole("button", { name: /add funds/i }).click();
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
