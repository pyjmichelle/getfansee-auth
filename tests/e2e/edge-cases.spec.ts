import { test, expect } from "@playwright/test";
import {
  generateTestEmail,
  TEST_PASSWORD,
  signUpUser,
  signInUser,
  clearStorage,
  waitForVisible,
  expectError,
} from "./shared/helpers";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";

/**
 * 边界情况和错误处理测试
 */
test.describe("边界情况和错误处理测试", () => {
  const fanEmail = generateTestEmail("fan");
  const creatorEmail = generateTestEmail("creator");

  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  test.describe("3.1 认证相关", () => {
    test("未登录用户访问受保护路由", async ({ page }) => {
      await clearStorage(page);

      // 尝试访问受保护的路由
      await page.goto(`${BASE_URL}/home`);

      // 验证重定向到 /auth
      await expect(page).toHaveURL(/\/auth/);
    });

    test("未登录用户访问 Creator 路由", async ({ page }) => {
      await clearStorage(page);

      // 尝试访问 Creator 路由
      await page.goto(`${BASE_URL}/creator/studio`);

      // 验证重定向到 /auth
      await expect(page).toHaveURL(/\/auth/);
    });

    test("Fan 用户访问 Creator 路由", async ({ page }) => {
      await signUpUser(page, fanEmail, TEST_PASSWORD);

      // 尝试访问 Creator 路由
      await page.goto(`${BASE_URL}/creator/studio`);

      // 根据 middleware 配置，应该重定向到 /home
      await page.waitForTimeout(2000);
      expect(page.url()).not.toContain("/creator/studio");
    });

    test("过期 Session 处理", async ({ page }) => {
      await signUpUser(page, fanEmail, TEST_PASSWORD);

      // 清除 session（模拟过期）
      await clearStorage(page);

      // 尝试访问受保护路由
      await page.goto(`${BASE_URL}/home`);

      // 验证重定向到 /auth
      await expect(page).toHaveURL(/\/auth/);
    });
  });

  test.describe("3.2 支付相关", () => {
    test.beforeEach(async ({ page }) => {
      await signUpUser(page, fanEmail, TEST_PASSWORD);
    });

    test("钱包余额不足时解锁 PPV", async ({ page }) => {
      // 这个测试需要：
      // 1. Creator 发布 PPV 内容
      // 2. Fan 钱包余额不足
      // 3. 尝试解锁
      // 4. 验证错误提示

      // 暂时跳过，需要先设置测试数据
      test.skip(true, "需要设置测试数据：PPV 内容和钱包余额");
    });

    test("订阅已订阅的 Creator", async ({ page }) => {
      // 这个测试需要：
      // 1. Fan 已订阅 Creator
      // 2. 再次点击订阅
      // 3. 验证重复订阅处理（应该更新而不是创建新记录）

      test.skip(true, "需要先完成订阅流程");
    });

    test("取消订阅后内容权限验证", async ({ page }) => {
      // 这个测试需要：
      // 1. Fan 订阅 Creator
      // 2. 验证内容可见
      // 3. 取消订阅
      // 4. 验证内容重新锁定

      test.skip(true, "需要先完成订阅和取消订阅流程");
    });
  });

  test.describe("3.3 内容相关", () => {
    test("未完成 KYC 的 Creator 尝试发布付费内容", async ({ page }) => {
      await signUpUser(page, creatorEmail, TEST_PASSWORD);

      // 成为 Creator（但不完成 KYC）
      const becomeCreatorButton = page
        .locator('button:has-text("Become a Creator"), a:has-text("Become a Creator")')
        .first();

      if (await becomeCreatorButton.isVisible()) {
        await becomeCreatorButton.click();
        await page.waitForTimeout(2000);

        // 只填写 Profile，不提交 KYC
        const displayNameInput = page
          .locator('input[name="display_name"], input[placeholder*="name" i]')
          .first();
        if (await displayNameInput.isVisible()) {
          await displayNameInput.fill(`Creator ${Date.now()}`);
          const nextButton = page
            .locator('button:has-text("下一步"), button:has-text("Next")')
            .first();
          await nextButton.click();
          await page.waitForTimeout(2000);
        }

        // 尝试创建付费内容
        await page.goto(`${BASE_URL}/creator/new-post`);
        await waitForVisible(
          page,
          'textarea[name="content"], textarea[placeholder*="content" i]',
          5000
        );

        const contentInput = page
          .locator('textarea[name="content"], textarea[placeholder*="content" i]')
          .first();
        await contentInput.fill("Test PPV Post");

        // 设置可见性为 PPV
        const visibilitySelect = page.locator('select[name="visibility"]').first();
        if (await visibilitySelect.isVisible()) {
          await visibilitySelect.selectOption("ppv");

          // 尝试发布
          const publishButton = page
            .locator('button:has-text("发布"), button:has-text("Publish")')
            .first();
          if (await publishButton.isVisible()) {
            await publishButton.click();
            await page.waitForTimeout(2000);

            // 验证错误提示（KYC 未完成）
            const errorMessage = page.locator("text=/kyc|verification|age.*verified/i");
            await expect(errorMessage.first()).toBeVisible({ timeout: 5000 });
          }
        }
      }
    });
  });

  test.describe("3.4 数据一致性", () => {
    test.beforeEach(async ({ page }) => {
      await signUpUser(page, fanEmail, TEST_PASSWORD);
    });

    test("订阅后立即刷新页面，验证状态保持", async ({ page }) => {
      // 这个测试需要先完成订阅流程
      test.skip(true, "需要先完成订阅流程");
    });

    test("解锁后立即刷新页面，验证内容可见", async ({ page }) => {
      // 这个测试需要先完成解锁流程
      test.skip(true, "需要先完成解锁流程");
    });
  });
});
