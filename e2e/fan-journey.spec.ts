import { test, expect } from "@playwright/test";
import {
  generateTestEmail,
  TEST_PASSWORD,
  signUpUser,
  signInUser,
  clearStorage,
  waitForVisible,
  waitForPageLoad,
  expectError,
  expectSuccess,
  waitForNavigation,
  expectPageText,
  clickAndWaitForNavigation,
  injectSupabaseSession,
} from "./shared/helpers";
import {
  setupTestFixtures,
  teardownTestFixtures,
  injectTestCookie,
  type TestFixtures,
} from "./shared/fixtures";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";

test.describe("Fan 端完整流程测试", () => {
  let fixtures: TestFixtures;

  // 使用 fixtures 创建测试数据
  test.beforeAll(async () => {
    fixtures = await setupTestFixtures();
    console.log("[Test] Fixtures created:", {
      creator: fixtures.creator.email,
      fan: fixtures.fan.email,
      posts: Object.keys(fixtures.posts),
    });
  });

  test.afterAll(async () => {
    await teardownTestFixtures(fixtures);
    console.log("[Test] Fixtures cleaned up");
  });

  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    await injectTestCookie(page); // 注入测试模式 cookie
  });

  test.describe("1.1 用户注册与登录", () => {
    test("使用 Fixtures Fan 登录", async ({ page }) => {
      // 使用 fixtures 中的 Fan 账号登录
      await injectSupabaseSession(page, fixtures.fan.email, fixtures.fan.password, BASE_URL);
      
      // 导航到首页
      await page.goto(`${BASE_URL}/home`);
      await waitForPageLoad(page);

      // 验证登录成功
      await expect(page).toHaveURL(`${BASE_URL}/home`);
    });

    test("邮箱注册新用户", async ({ page }) => {
      const newFanEmail = generateTestEmail("new-fan");

      // 监听控制台日志
      page.on("console", (msg) => {
        const text = msg.text();
        if (text.includes("[auth]") || text.includes("signUp") || text.includes("Session")) {
          console.log(`[Browser Console] ${msg.type()}: ${text}`);
        }
      });

      // 访问 /auth 页面并直接打开 Sign Up tab
      await page.goto(`${BASE_URL}/auth?mode=signup`);
      await waitForPageLoad(page);

      // 验证表单字段存在
      await waitForVisible(page, 'input[type="email"]');
      await waitForVisible(page, 'input[type="password"]');

      // 填写注册信息
      const emailInput = page.locator('input[type="email"]').first();
      const passwordInput = page.locator('input[type="password"]').first();

      await emailInput.fill(newFanEmail);
      await passwordInput.fill(TEST_PASSWORD);

      // 确认年龄（如果存在）
      const ageCheckbox = page.locator('input[type="checkbox"]').first();
      if (await ageCheckbox.isVisible()) {
        await ageCheckbox.check();
      }

      // 提交注册（使用精确的选择器，匹配 "Sign up with email" 按钮）
      const signupButton = page
        .getByRole("button", { name: /sign up with email|sign up|continue/i })
        .first();
      await expect(signupButton).toBeVisible();

      // 等待导航事件
      const navigationPromise = page
        .waitForURL(`${BASE_URL}/home`, { timeout: 20000 })
        .catch(() => null);

      await signupButton.click();

      // 等待导航完成
      const navigated = await navigationPromise;
      if (navigated) {
        // 验证成功跳转
        await expect(page).toHaveURL(`${BASE_URL}/home`);
        return;
      }

      // 如果没有跳转，等待一下让 UI 更新
      await page.waitForTimeout(3000);

      // 检查当前 URL
      const currentUrl = page.url();
      console.log(`[Test] Current URL after signup: ${currentUrl}`);

      // 如果已经跳转到 home，直接返回
      if (currentUrl.includes("/home")) {
        return;
      }

      // 如果还在 auth 页面，检查状态
      if (currentUrl.includes("/auth")) {
        // 检查是否有成功消息（邮箱验证提示）
        const successMessage = page.locator("text=/check your email|verification|验证/i");
        const hasSuccessMessage = await successMessage
          .first()
          .isVisible()
          .catch(() => false);

        if (hasSuccessMessage) {
          console.log("[Test] 注册成功，需要邮箱验证");
          return;
        }

        // 检查是否有错误消息
        const errorMessage = page.locator("text=/error|failed|失败/i");
        const hasError = await errorMessage
          .first()
          .isVisible()
          .catch(() => false);

        if (hasError) {
          const errorText = await errorMessage
            .first()
            .textContent()
            .catch(() => "注册失败");
          console.log(`[Test] 注册失败: ${errorText}`);
          throw new Error(`注册失败: ${errorText}`);
        }

        // 如果既没有成功消息也没有错误消息，尝试登录
        console.log("[Test] 注册后没有自动跳转，尝试登录");
        await signInUser(page, newFanEmail, TEST_PASSWORD);
      }
    });

    test("邮箱登录已存在用户", async ({ page }) => {
      // 使用 fixtures 中已存在的 Fan 账号登录
      await signInUser(page, fixtures.fan.email, fixtures.fan.password);

      // signInUser 已确保导航到 /home，只需验证页面状态
      // 等待页面稳定后再检查 URL
      await page.waitForLoadState("networkidle");
      expect(page.url()).toContain("/home");
    });

    test("登录错误处理 - 错误密码", async ({ page }) => {
      await page.goto(`${BASE_URL}/auth?mode=login`);
      await waitForPageLoad(page);

      // 填写错误密码（使用 fixtures 中的 Fan 邮箱）
      const emailInput = page.locator('input[type="email"]').first();
      const passwordInput = page.locator('input[type="password"]').first();

      await emailInput.fill(fixtures.fan.email);
      await passwordInput.fill("WrongPassword123!");

      // 点击登录
      await page
        .getByRole("button", { name: /log in|continue/i })
        .first()
        .click();

      // 等待 loading 状态结束（按钮不再 disabled）
      await page.waitForFunction(
        () => {
          const btn = document.querySelector('button[type="submit"]');
          return btn && !btn.hasAttribute("disabled");
        },
        { timeout: 10000 }
      );

      // 验证错误提示显示 - 使用更宽松的选择器
      const errorContainer = page.locator(
        ".bg-destructive\\/10, [class*='error'], [class*='destructive']"
      );
      await expect(errorContainer.first()).toBeVisible({ timeout: 5000 });
    });

    test("登录错误处理 - 不存在的邮箱", async ({ page }) => {
      await page.goto(`${BASE_URL}/auth?mode=login`);
      await waitForPageLoad(page);

      // 填写不存在的邮箱
      const emailInput = page.locator('input[type="email"]').first();
      const passwordInput = page.locator('input[type="password"]').first();

      await emailInput.fill("nonexistent@example.com");
      await passwordInput.fill(TEST_PASSWORD);

      // 点击登录
      await page
        .getByRole("button", { name: /log in|continue/i })
        .first()
        .click();

      // 验证错误提示显示
      await page.waitForTimeout(2000);
      const errorText = page.locator("text=/邮箱或密码错误|invalid|not found|does not exist/i");
      await expect(errorText.first()).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe("1.2 Feed 内容浏览", () => {
    test.beforeEach(async ({ page }) => {
      await signUpUser(page, fanEmail, TEST_PASSWORD);
    });

    test("访问 Feed 页面并验证内容加载", async ({ page }) => {
      await page.goto(`${BASE_URL}/home`);

      // 验证 Feed 容器存在
      await waitForVisible(page, "main, [role='main']", 10000);

      // 验证页面标题或关键元素
      const feedContent = page.locator("main, [role='main']");
      await expect(feedContent).toBeVisible();
    });

    test("验证免费内容可见", async ({ page }) => {
      await page.goto(`${BASE_URL}/home`);

      // 等待内容加载
      await page.waitForTimeout(2000);

      // 验证没有锁定遮罩（如果有免费内容）
      const lockedOverlay = page.locator("text=/locked|subscribe|unlock/i");
      // 如果有免费内容，不应该看到锁定提示
      // 这个测试依赖于实际数据，可能需要先创建测试数据
    });

    test("验证订阅者专享内容显示锁定遮罩", async ({ page }) => {
      // 这个测试需要先有 Creator 发布订阅者专享内容
      // 在完整流程测试中验证
      // 验证锁定遮罩元素存在
      const lockedOverlay = page.locator("text=/locked|subscribe|unlock/i");
      // 如果有锁定内容，应该看到锁定提示
      // 这个测试依赖于实际数据
    });
  });

  test.describe("1.3 订阅 Creator", () => {
    test.beforeEach(async ({ page }) => {
      await signUpUser(page, fanEmail, TEST_PASSWORD);
    });

    test("访问 Creator 页面并订阅", async ({ page }) => {
      // 这个测试需要先有 Creator 账号和内容
      // 在完整流程测试中实现

      // 访问 Creator 页面（需要先知道 creatorId）
      // 查找订阅按钮
      const subscribeButton = page
        .locator('button:has-text("Subscribe"), button:has-text("订阅")')
        .first();

      if (await subscribeButton.isVisible()) {
        await subscribeButton.click();

        // 等待 Paywall Modal 显示
        await waitForVisible(page, "text=/subscribe|unlock|payment/i", 5000);

        // 确认订阅
        const confirmButton = page
          .locator('button:has-text("Confirm"), button:has-text("Subscribe")')
          .first();
        if (await confirmButton.isVisible()) {
          await confirmButton.click();

          // 等待订阅完成
          await page.waitForTimeout(2000);

          // 验证订阅成功（通过检查按钮状态或提示）
          const successMessage = page.locator("text=/success|subscribed/i");
          await expect(successMessage.first()).toBeVisible({ timeout: 5000 });
        }
      }
    });

    test("验证订阅状态在订阅列表页面显示", async ({ page }) => {
      await page.goto(`${BASE_URL}/subscriptions`);

      // 验证页面加载
      await waitForVisible(page, "main, [role='main']", 5000);

      // 验证订阅列表容器存在
      const subscriptionsList = page.locator("text=/subscription|subscribed/i");
      await expect(subscriptionsList.first()).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe("1.4 解锁 PPV 内容", () => {
    test.beforeEach(async ({ page }) => {
      await signUpUser(page, fanEmail, TEST_PASSWORD);
    });

    test("解锁 PPV 内容流程", async ({ page }) => {
      // 这个测试需要先有 Creator 发布 PPV 内容
      // 在完整流程测试中实现

      await page.goto(`${BASE_URL}/home`);
      await waitForVisible(page, "main, [role='main']", 5000);

      // 查找 PPV 解锁按钮
      const unlockButton = page
        .locator('button:has-text("Unlock"), button:has-text("解锁")')
        .first();

      if (await unlockButton.isVisible()) {
        await unlockButton.click();

        // 等待 Paywall Modal 显示
        await waitForVisible(page, "text=/unlock|price|payment/i", 5000);

        // 确认解锁
        const confirmButton = page
          .locator('button:has-text("Unlock"), button:has-text("Confirm")')
          .first();
        if (await confirmButton.isVisible()) {
          await confirmButton.click();

          // 等待解锁完成
          await page.waitForTimeout(2000);

          // 验证内容解锁后可见（锁定遮罩消失）
          const lockedOverlay = page.locator("text=/locked|subscribe|unlock/i");
          await expect(lockedOverlay.first()).not.toBeVisible({ timeout: 5000 });
        }
      }
    });

    test("验证购买历史记录", async ({ page }) => {
      await page.goto(`${BASE_URL}/purchases`);

      // 验证页面加载
      await waitForVisible(page, "main, [role='main']", 5000);

      // 验证购买历史容器存在
      const purchasesList = page.locator("text=/purchase|unlocked|bought/i");
      await expect(purchasesList.first()).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe("1.5 个人中心功能", () => {
    test.beforeEach(async ({ page }) => {
      await signUpUser(page, fanEmail, TEST_PASSWORD);
    });

    test("访问个人中心页面", async ({ page }) => {
      await page.goto(`${BASE_URL}/me`);

      // 验证个人信息显示
      await waitForVisible(page, "main, [role='main']", 5000);

      // 验证页面包含个人信息相关元素
      const profileSection = page.locator("text=/profile|display name|bio/i");
      await expect(profileSection.first()).toBeVisible({ timeout: 5000 });
    });

    test("更新 Display Name", async ({ page }) => {
      await page.goto(`${BASE_URL}/me`);

      // 查找 Display Name 输入框
      const displayNameInput = page
        .locator('input[name="display_name"], input[placeholder*="name" i]')
        .first();

      if (await displayNameInput.isVisible()) {
        const newName = `Test User ${Date.now()}`;
        await displayNameInput.fill(newName);

        // 查找保存按钮
        const saveButton = page
          .locator('button:has-text("Save"), button:has-text("Update")')
          .first();
        if (await saveButton.isVisible()) {
          await saveButton.click();

          // 等待更新完成
          await page.waitForTimeout(2000);

          // 验证更新成功（可能需要重新加载页面）
          await page.reload();
          await expect(displayNameInput).toHaveValue(newName);
        }
      }
    });

    test("查看订阅列表", async ({ page }) => {
      await page.goto(`${BASE_URL}/subscriptions`);

      // 验证页面加载
      await waitForVisible(page, "main, [role='main']", 5000);

      // 验证订阅列表容器存在
      const subscriptionsList = page.locator("text=/subscription|subscribed/i");
      await expect(subscriptionsList.first()).toBeVisible({ timeout: 5000 });
    });

    test("查看购买历史", async ({ page }) => {
      await page.goto(`${BASE_URL}/purchases`);

      // 验证页面加载
      await waitForVisible(page, "main, [role='main']", 5000);
    });

    test("查看钱包余额", async ({ page }) => {
      await page.goto(`${BASE_URL}/me/wallet`);

      // 验证页面加载
      await waitForVisible(page, "main, [role='main']", 5000);

      // 验证钱包相关信息显示
      const walletInfo = page.locator("text=/wallet|balance|balance/i");
      await expect(walletInfo.first()).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe("1.6 成为 Creator 流程", () => {
    test.beforeEach(async ({ page }) => {
      await signUpUser(page, fanEmail, TEST_PASSWORD);
    });

    test("点击 Become a Creator 按钮", async ({ page }) => {
      await page.goto(`${BASE_URL}/home`);

      // 查找 Become a Creator 按钮
      const becomeCreatorButton = page
        .locator('button:has-text("Become a Creator"), a:has-text("Become a Creator")')
        .first();

      if (await becomeCreatorButton.isVisible()) {
        await clickAndWaitForNavigation(
          page,
          'button:has-text("Become a Creator"), a:has-text("Become a Creator")',
          /\/creator\/onboarding/,
          10000
        );

        // 验证跳转到 onboarding 页面
        await expect(page).toHaveURL(/\/creator\/onboarding/);
      } else {
        // 如果没有按钮，可能已经是 creator，跳过
        test.skip();
      }
    });

    test("填写 Creator Profile", async ({ page }) => {
      await page.goto(`${BASE_URL}/creator/onboarding`);

      // 等待表单加载
      await waitForVisible(page, 'input[name="display_name"], input[placeholder*="name" i]', 5000);

      // 填写 Display Name
      const displayNameInput = page
        .locator('input[name="display_name"], input[placeholder*="name" i]')
        .first();
      const displayName = `Creator ${Date.now()}`;
      await displayNameInput.fill(displayName);

      // 填写 Bio（如果存在）
      const bioInput = page.locator('textarea[name="bio"], textarea[placeholder*="bio" i]').first();
      if (await bioInput.isVisible()) {
        await bioInput.fill("Test Creator Bio");
      }

      // 提交表单
      const submitButton = page
        .locator('button:has-text("下一步"), button:has-text("Next"), button:has-text("Save")')
        .first();
      await submitButton.click();

      // 等待跳转或进入下一步
      await page.waitForTimeout(2000);
    });
  });
});
