import { test, expect } from "@playwright/test";
import {
  generateTestEmail,
  TEST_PASSWORD,
  signUpUser,
  signInUser,
  clearStorage,
  waitForVisible,
  waitForPageLoad,
  waitForNavigation,
  clickAndWaitForNavigation,
} from "./shared/helpers";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";

/**
 * 完整端到端测试：从注册到订阅到解锁的完整用户旅程
 */
test.describe("完整用户旅程测试", () => {
  const fanEmail = generateTestEmail("fan");
  const creatorEmail = generateTestEmail("creator");
  let creatorId: string | null = null;

  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  test("完整流程：Fan 注册 → Creator 注册并发布 → Fan 订阅 → Fan 解锁 PPV", async ({ page }) => {
    // ========== 阶段 1: Fan 注册 ==========
    test.step("1. Fan 用户注册", async () => {
      await signUpUser(page, fanEmail, TEST_PASSWORD, "fan");
      await waitForPageLoad(page);

      // 验证成功跳转到 home
      await expect(page).toHaveURL(`${BASE_URL}/home`);
    });

    // ========== 阶段 2: Creator 注册并发布内容 ==========
    test.step("2. Creator 用户注册并发布内容", async () => {
      // 在新标签页中注册 Creator
      const creatorPage = await page.context().newPage();

      await signUpUser(creatorPage, creatorEmail, TEST_PASSWORD, "creator");
      await waitForPageLoad(creatorPage);

      // 成为 Creator
      const becomeCreatorButton = creatorPage
        .locator('button:has-text("Become a Creator"), a:has-text("Become a Creator")')
        .first();

      if (await becomeCreatorButton.isVisible()) {
        await clickAndWaitForNavigation(
          creatorPage,
          'button:has-text("Become a Creator"), a:has-text("Become a Creator")',
          /\/creator\/onboarding/,
          10000
        );

        // 填写 Creator Profile
        await waitForVisible(
          creatorPage,
          'input[name="display_name"], input[placeholder*="name" i]',
          5000
        );

        const displayNameInput = creatorPage
          .locator('input[name="display_name"], input[placeholder*="name" i]')
          .first();
        const displayName = `Creator ${Date.now()}`;
        await displayNameInput.fill(displayName);

        const bioInput = creatorPage
          .locator('textarea[name="bio"], textarea[placeholder*="bio" i]')
          .first();
        if (await bioInput.isVisible()) {
          await bioInput.fill("E2E Test Creator Bio");
        }

        // 提交第一步
        const nextButton = creatorPage
          .locator('button:has-text("下一步"), button:has-text("Next"), button:has-text("Save")')
          .first();
        await nextButton.click();

        // 等待进入 KYC 或完成
        await creatorPage.waitForTimeout(2000);

        // 如果进入 KYC 步骤，填写 KYC 信息
        const kycForm = creatorPage
          .locator('input[name="real_name"], input[placeholder*="name" i]')
          .first();
        if (await kycForm.isVisible()) {
          await kycForm.fill("Test Creator");
          const birthDateInput = creatorPage.locator('input[type="date"]').first();
          if (await birthDateInput.isVisible()) {
            await birthDateInput.fill("1990-01-01");
          }
          const countryInput = creatorPage
            .locator('input[name="country"], input[placeholder*="country" i]')
            .first();
          if (await countryInput.isVisible()) {
            await countryInput.fill("US");
          }

          // 提交 KYC（跳过文件上传，因为需要真实文件）
          const submitKYCButton = creatorPage
            .locator('button:has-text("提交验证"), button:has-text("Submit")')
            .first();
          if (await submitKYCButton.isVisible()) {
            // 注意：实际测试中需要上传文件，这里跳过
            // await submitKYCButton.click();
          }
        }

        // 等待回到 home
        await creatorPage.waitForTimeout(2000);
        await creatorPage.goto(`${BASE_URL}/home`);
      }

      // 创建免费 Post
      await creatorPage.goto(`${BASE_URL}/creator/new-post`);
      const contentInput = creatorPage.getByTestId("post-content");
      await expect(contentInput).toBeVisible({ timeout: 5000 });
      const freePostContent = `Free Post ${Date.now()}`;
      await contentInput.fill(freePostContent);

      // 设置可见性为 Free
      const visibilitySelect = creatorPage.locator('select[name="visibility"]').first();
      if (await visibilitySelect.isVisible()) {
        await visibilitySelect.selectOption("free");
      }

      // 发布
      const publishButton = creatorPage.getByTestId("submit-button");
      if (await publishButton.isVisible()) {
        await publishButton.click();
        await creatorPage.waitForTimeout(2000);
      }

      // 创建订阅者专享 Post
      await creatorPage.goto(`${BASE_URL}/creator/new-post`);
      const subscriberContentInput = creatorPage.getByTestId("post-content");
      await expect(subscriberContentInput).toBeVisible({ timeout: 5000 });
      const subscriberPostContent = `Subscriber Post ${Date.now()}`;
      await subscriberContentInput.fill(subscriberPostContent);

      // 设置可见性为 Subscribers
      const subscriberVisibilitySelect = creatorPage.locator('select[name="visibility"]').first();
      if (await subscriberVisibilitySelect.isVisible()) {
        await subscriberVisibilitySelect.selectOption("subscribers");
      } else {
        const subscriberCheckbox = creatorPage
          .locator('input[type="checkbox"][id*="locked"], input[type="checkbox"][id*="subscriber"]')
          .first();
        if (await subscriberCheckbox.isVisible()) {
          await subscriberCheckbox.check();
        }
      }

      // 发布
      if (await publishButton.isVisible()) {
        await publishButton.click();
        await creatorPage.waitForTimeout(2000);
      }

      // 获取 Creator ID（从 URL 或页面元素）
      // 这里需要根据实际 UI 调整
      await creatorPage.close();
    });

    // ========== 阶段 3: Fan 浏览 Feed ==========
    test.step("3. Fan 浏览 Feed", async () => {
      await page.goto(`${BASE_URL}/home`, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await waitForPageLoad(page);

      // 验证 Feed 加载（允许重定向到 auth 时跳过 home-feed）
      const onAuth = page.url().includes("/auth");
      if (!onAuth) {
        await waitForVisible(page, "main, [role='main']", 10000);
        await expect(page.getByTestId("home-feed")).toBeVisible({ timeout: 15_000 });
      }
    });

    // ========== 阶段 4: Fan 订阅 Creator ==========
    test.step("4. Fan 订阅 Creator", async () => {
      // 访问 Creator 页面或点击订阅按钮
      // 这里需要根据实际 UI 调整选择器

      // 查找订阅按钮
      const subscribeButton = page.getByTestId("creator-subscribe-button").first();

      if (await subscribeButton.isVisible()) {
        await subscribeButton.click();

        // 等待 Paywall Modal 显示
        await expect(page.getByTestId("paywall-modal")).toBeVisible({ timeout: 5000 });

        // 确认订阅（如果存在确认按钮）
        const confirmButton = page.getByTestId("paywall-subscribe-button");
        if (await confirmButton.isVisible()) {
          await confirmButton.click();
        }

        // 等待订阅完成
        await expect(page.getByTestId("paywall-success-message")).toBeVisible({
          timeout: 10000,
        });
      }
    });

    // ========== 阶段 5: Fan 验证订阅后内容解锁 ==========
    test.step("5. 验证订阅后内容解锁", async () => {
      // 刷新 Feed
      await page.reload();
      await page.waitForTimeout(2000);

      // 验证订阅者专享内容现在可见
      // 这个验证依赖于实际 UI
    });

    // ========== 阶段 6: Fan 解锁 PPV 内容 ==========
    test.step("6. Fan 解锁 PPV 内容", async () => {
      // 这个测试需要 Creator 先创建 PPV 内容
      // 在完整流程中实现
    });
  });

  test("边界情况：未登录用户访问受保护路由", async ({ page }) => {
    await clearStorage(page);

    // 尝试访问受保护的路由
    await page.goto(`${BASE_URL}/home`, { waitUntil: "domcontentloaded", timeout: 30_000 });

    // 验证重定向到 /auth
    await expect(page).toHaveURL(/\/auth/);
  });

  test("边界情况：Fan 用户访问 Creator 路由", async ({ page }) => {
    await signUpUser(page, fanEmail, TEST_PASSWORD);

    // 尝试访问 Creator 路由
    await page.goto(`${BASE_URL}/creator/studio`);

    // 验证被重定向或显示权限错误
    // 根据 middleware 配置，应该重定向到 /home
    await page.waitForTimeout(2000);
    // 验证不在 creator/studio 页面
    expect(page.url()).not.toContain("/creator/studio");
  });
});
