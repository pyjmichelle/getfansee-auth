import { test, expect } from "@playwright/test";
import {
  clearStorage,
  createConfirmedTestUser,
  deleteTestUser,
  injectSupabaseSession,
} from "./shared/helpers";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const RECHARGE_AMOUNT = 10;
const PPV_PRICE = 5;

test.describe("Sprint 4.0 MVP monetization flow", () => {
  test("creator publishes PPV; fan recharges wallet and unlocks content", async ({ browser }) => {
    test.setTimeout(180_000);

    const postContent = `Sprint4 PPV ${Date.now()}`;

    const fanPage = await browser.newPage();
    const creatorPage = await browser.newPage();
    const createdUserIds: string[] = [];

    try {
      await test.step("Creator setup & publish PPV", async () => {
        await clearStorage(creatorPage);
        const creatorAccount = await createConfirmedTestUser("creator");
        createdUserIds.push(creatorAccount.userId);
        await injectSupabaseSession(
          creatorPage,
          creatorAccount.email,
          creatorAccount.password,
          BASE_URL
        );

        await creatorPage.evaluate(async () => {
          await fetch("/api/creator/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              display_name: "Sprint4 Creator",
              bio: "Automated test creator",
            }),
          });
        });

        await creatorPage.goto(`${BASE_URL}/creator/new-post`);
        await creatorPage.fill('textarea[id="content"], textarea', postContent);
        await creatorPage.click('input[name="visibility"][value="ppv"]');
        await creatorPage.fill("#price", PPV_PRICE.toString());
        await creatorPage.click(
          'button:has-text("Publish"), button:has-text("发布"), button:has-text("Publish Post")'
        );
        await creatorPage.waitForURL(/\/home$/, { timeout: 30_000 });
      });

      await test.step("Fan setup & wallet recharge", async () => {
        await clearStorage(fanPage);
        const fanAccount = await createConfirmedTestUser("fan");
        createdUserIds.push(fanAccount.userId);
        await injectSupabaseSession(fanPage, fanAccount.email, fanAccount.password, BASE_URL);

        await fanPage.goto(`${BASE_URL}/me/wallet`);
        await fanPage
          .locator("button", { hasText: `$${RECHARGE_AMOUNT}` })
          .first()
          .click();
        await fanPage
          .locator("button", { hasText: new RegExp(`Recharge\\s*\\$${RECHARGE_AMOUNT}`) })
          .click();
        await expect(fanPage.locator("text=成功充值")).toBeVisible({ timeout: 10_000 });
        await expect(
          fanPage.locator("h1", { hasText: `$${RECHARGE_AMOUNT.toFixed(2)}` })
        ).toBeVisible();
      });

      const targetCard = await test.step("Fan sees locked post", async () => {
        await fanPage.goto(`${BASE_URL}/home`);
        const card = fanPage.locator("article").filter({ hasText: postContent }).first();
        await expect(card).toBeVisible({ timeout: 30_000 });
        await expect(
          card.locator(`text=Unlock this post for $${PPV_PRICE.toFixed(2)}`)
        ).toBeVisible();
        return card;
      });

      await test.step("Fan unlocks PPV via Paywall", async () => {
        await targetCard.locator(`button:has-text("Unlock for $${PPV_PRICE.toFixed(2)}")`).click();

        const modal = fanPage.locator("text=Unlock This Content").first();
        await expect(modal).toBeVisible({ timeout: 10_000 });
        await expect(fanPage.locator("text=当前余额")).toBeVisible();
        await fanPage.locator(`button:has-text("Unlock for $${PPV_PRICE.toFixed(2)}")`).click();
        await expect(fanPage.locator("text=Payment Successful!")).toBeVisible({ timeout: 15_000 });
        await fanPage.waitForTimeout(1500);
        await expect(
          targetCard.locator(`text=Unlock this post for $${PPV_PRICE.toFixed(2)}`)
        ).toHaveCount(0);
      });

      await test.step("Fan purchase history reflects unlock", async () => {
        await fanPage.goto(`${BASE_URL}/purchases`);
        await expect(fanPage.locator("text=Your Purchases")).toBeVisible();
        await expect(fanPage.locator("text=" + postContent)).toBeVisible({ timeout: 15_000 });
        await expect(fanPage.locator(`text=$${PPV_PRICE.toFixed(2)}`).first()).toBeVisible();
      });

      await test.step("Creator earnings updated", async () => {
        await creatorPage.goto(`${BASE_URL}/creator/studio/earnings`);
        await expect(creatorPage.locator("text=Total Earnings")).toBeVisible({ timeout: 15_000 });
        await expect(creatorPage.locator(`text=$${PPV_PRICE.toFixed(2)}`)).toBeVisible({
          timeout: 15_000,
        });
      });
    } finally {
      await fanPage.close();
      await creatorPage.close();
      for (const userId of createdUserIds) {
        await deleteTestUser(userId);
      }
    }
  });
});
