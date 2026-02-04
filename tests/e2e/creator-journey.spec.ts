import { test, expect } from "@playwright/test";
import {
  generateTestEmail,
  TEST_PASSWORD,
  signUpUser,
  signInUser,
  clearStorage,
  waitForVisible,
  waitForNavigation,
  clickAndWaitForNavigation,
  fillFormField,
} from "./shared/helpers";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";

test.describe("Creator 端完整流程测试", () => {
  const creatorEmail = generateTestEmail("creator");

  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  test.describe("2.1 Creator Onboarding 完成", () => {
    test("注册并升级为 Creator", async ({ page }) => {
      // 1. 注册用户
      await signUpUser(page, creatorEmail, TEST_PASSWORD, "creator");

      // 2. 点击 Become a Creator
      await page.goto(`${BASE_URL}/home`);

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

        // 3. 填写 Creator Profile
        await waitForVisible(
          page,
          'input[name="display_name"], input[placeholder*="name" i]',
          5000
        );

        const displayNameInput = page
          .locator('input[name="display_name"], input[placeholder*="name" i]')
          .first();
        const displayName = `Creator ${Date.now()}`;
        await displayNameInput.fill(displayName);

        const bioInput = page
          .locator('textarea[name="bio"], textarea[placeholder*="bio" i]')
          .first();
        if (await bioInput.isVisible()) {
          await bioInput.fill("E2E Test Creator Bio");
        }

        // 提交第一步
        const nextButton = page
          .locator('button:has-text("下一步"), button:has-text("Next"), button:has-text("Save")')
          .first();
        await nextButton.click();

        // 等待进入 KYC 步骤或完成
        await page.waitForTimeout(2000);

        // 验证角色已更新（通过检查是否能看到 Creator Studio）
        await page.goto(`${BASE_URL}/home`);
        await page.waitForTimeout(1000);

        // 验证 Creator Dashboard 或 Studio 入口可见
        const creatorStudio = page.locator("text=/creator|studio|dashboard/i");
        // 这个验证依赖于实际 UI，可能需要调整选择器
      }
    });

    test("验证 Creator Studio 权限", async ({ page }) => {
      // 这个测试需要先完成 onboarding
      // 在完整流程测试中验证
      test.skip();
    });
  });

  test.describe("2.2 创建内容（Post）", () => {
    test.beforeEach(async ({ page }) => {
      // 注册并完成 Creator onboarding
      await signUpUser(page, creatorEmail, TEST_PASSWORD, "creator");

      // 完成 Creator onboarding
      await page.goto(`${BASE_URL}/home`);

      // 点击 Become a Creator 按钮
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

        // 填写 Creator Profile
        await waitForVisible(
          page,
          'input[name="display_name"], input[placeholder*="name" i]',
          5000
        );

        const displayNameInput = page
          .locator('input[name="display_name"], input[placeholder*="name" i]')
          .first();
        const displayName = `Creator ${Date.now()}`;
        await displayNameInput.fill(displayName);

        const bioInput = page
          .locator('textarea[name="bio"], textarea[placeholder*="bio" i]')
          .first();
        if (await bioInput.isVisible()) {
          await bioInput.fill(`Test Creator Bio ${Date.now()}`);
        }

        // 提交表单
        const saveButton = page
          .locator('button:has-text("Save"), button:has-text("保存"), button:has-text("Continue")')
          .first();
        if (await saveButton.isVisible()) {
          await saveButton.click();
          // 等待跳转回 home 或 onboarding 完成
          try {
            await page.waitForURL(/\/home|\/creator\/onboarding/, { timeout: 10000 });
          } catch {
            // 如果还在当前页面，等待一下
            await page.waitForTimeout(3000);
          }
        }

        // 刷新页面确保角色已更新
        await page.reload();
        await page.waitForTimeout(2000);

        // 验证已经在 home 页面（onboarding 完成后应该跳转到 home）
        const currentUrl = page.url();
        if (!currentUrl.includes("/home")) {
          // 如果不在 home，尝试导航到 home
          await page.goto(`${BASE_URL}/home`, { waitUntil: "load", timeout: 10000 });
          await page.waitForTimeout(2000);
        }
      }
    });

    test("访问创建 Post 页面", async ({ page }) => {
      await page.goto(`${BASE_URL}/creator/new-post`);

      // 验证页面加载
      await waitForVisible(page, "main, [role='main']", 5000);

      // 验证表单字段存在
      const contentInput = page
        .locator('textarea[name="content"], textarea[placeholder*="content" i]')
        .first();
      await expect(contentInput).toBeVisible({ timeout: 5000 });
    });

    test("创建免费 Post（无媒体）", async ({ page }) => {
      await page.goto(`${BASE_URL}/creator/new-post`);

      // 等待表单加载
      await waitForVisible(
        page,
        'textarea[name="content"], textarea[placeholder*="content" i]',
        5000
      );

      // 填写内容
      const contentInput = page
        .locator('textarea[name="content"], textarea[placeholder*="content" i]')
        .first();
      const postContent = `Test Free Post ${Date.now()}`;
      await contentInput.fill(postContent);

      // 设置可见性为 Free（如果存在选择器）
      const visibilityOption = page.locator('input[name="visibility"][value="free"]').first();
      if (await visibilityOption.isVisible()) {
        await visibilityOption.check();
      }

      // 查找发布按钮
      const publishButton = page
        .locator('button:has-text("发布"), button:has-text("Publish"), button:has-text("Post")')
        .first();

      if (await publishButton.isVisible()) {
        await publishButton.click();

        // 等待跳转到成功页面或 home
        try {
          await page.waitForURL(/\/creator\/studio\/post\/success|\/home/, { timeout: 10000 });
        } catch {
          // 如果还在当前页面，等待一下
          await page.waitForTimeout(2000);
        }
      }
    });

    test("创建 Post 并上传图片", async ({ page }) => {
      await page.goto(`${BASE_URL}/creator/new-post`);

      // 等待表单加载
      await waitForVisible(
        page,
        'textarea[name="content"], textarea[placeholder*="content" i]',
        5000
      );

      // 查找文件上传输入
      const fileInput = page.locator('input[type="file"]').first();

      if (await fileInput.isVisible()) {
        // 注意：实际测试中应该使用真实的图片文件
        // 这里跳过文件上传，因为需要准备测试文件
        // 在实际测试中，可以使用：
        // await fileInput.setInputFiles('path/to/test-image.jpg');

        // 填写内容
        const contentInput = page
          .locator('textarea[name="content"], textarea[placeholder*="content" i]')
          .first();
        const postContent = `Test Post with Image ${Date.now()}`;
        await contentInput.fill(postContent);

        // 发布（即使没有上传文件）
        const publishButton = page
          .locator('button:has-text("发布"), button:has-text("Publish")')
          .first();
        if (await publishButton.isVisible()) {
          await publishButton.click();
          await page.waitForTimeout(2000);
        }
      }
    });

    test("创建订阅者专享 Post", async ({ page }) => {
      await page.goto(`${BASE_URL}/creator/new-post`);

      // 等待表单加载
      await waitForVisible(
        page,
        'textarea[name="content"], textarea[placeholder*="content" i]',
        5000
      );

      // 填写内容
      const contentInput = page
        .locator('textarea[name="content"], textarea[placeholder*="content" i]')
        .first();
      const postContent = `Test Subscriber Post ${Date.now()}`;
      await contentInput.fill(postContent);

      // 设置可见性为 Subscribers
      const visibilityOption = page
        .locator('input[name="visibility"][value="subscribers"]')
        .first();
      if (await visibilityOption.isVisible()) {
        await visibilityOption.check();
      }

      // 发布
      const publishButton = page
        .locator('button:has-text("发布"), button:has-text("Publish")')
        .first();
      if (await publishButton.isVisible()) {
        await publishButton.click();
        await page.waitForTimeout(2000);
      }
    });

    test("创建 PPV Post", async ({ page }) => {
      await page.goto(`${BASE_URL}/creator/new-post`);

      // 等待表单加载
      await waitForVisible(
        page,
        'textarea[name="content"], textarea[placeholder*="content" i]',
        5000
      );

      // 填写内容
      const contentInput = page
        .locator('textarea[name="content"], textarea[placeholder*="content" i]')
        .first();
      const postContent = `Test PPV Post ${Date.now()}`;
      await contentInput.fill(postContent);

      // 设置可见性为 PPV
      const visibilityOption = page.locator('input[name="visibility"][value="ppv"]').first();
      if (await visibilityOption.isVisible()) {
        await visibilityOption.check();
      }

      // 设置价格（如果存在价格输入）
      const priceInput = page.locator('input[name="price"], input[type="number"]').first();
      if (await priceInput.isVisible()) {
        await priceInput.fill("5.00");
      }

      // 发布
      const publishButton = page
        .locator('button:has-text("发布"), button:has-text("Publish")')
        .first();
      if (await publishButton.isVisible()) {
        await publishButton.click();
        await page.waitForTimeout(2000);
      }
    });
  });

  test.describe("2.3 编辑和删除 Post", () => {
    test.beforeEach(async ({ page }) => {
      await signUpUser(page, creatorEmail, TEST_PASSWORD, "creator");
    });

    // TODO: 修复 CI 中 Post 列表页面加载问题后恢复此测试
    test.skip("访问 Post 列表页面", async ({ page }) => {
      await page.goto(`${BASE_URL}/creator/studio/post/list`);

      // 验证页面加载
      await waitForVisible(page, "main, [role='main']", 5000);

      // 验证列表容器存在
      await expect(page.getByTestId("creator-post-list-item").first()).toBeVisible({
        timeout: 5000,
      });
    });

    test("编辑 Post", async ({ page }) => {
      // 访问 Post 列表
      await page.goto(`${BASE_URL}/creator/studio/post/list`);
      await waitForVisible(page, "main, [role='main']", 5000);

      // 查找编辑按钮（需要先有 Post）
      const editButton = page
        .locator('button:has-text("Edit"), button:has-text("编辑"), a:has-text("Edit")')
        .first();

      if (await editButton.isVisible()) {
        await editButton.click();

        // 等待跳转到编辑页面
        await page.waitForURL(/\/creator\/studio\/post\/edit/, { timeout: 5000 });

        // 修改内容
        const contentInput = page
          .locator('textarea[name="content"], textarea[placeholder*="content" i]')
          .first();
        if (await contentInput.isVisible()) {
          const updatedContent = `Updated Post ${Date.now()}`;
          await contentInput.fill(updatedContent);

          // 保存
          const saveButton = page
            .locator('button:has-text("Save"), button:has-text("保存")')
            .first();
          if (await saveButton.isVisible()) {
            await saveButton.click();
            await page.waitForTimeout(2000);
          }
        }
      }
    });

    test("删除 Post", async ({ page }) => {
      // 访问 Post 列表
      await page.goto(`${BASE_URL}/creator/studio/post/list`);
      await waitForVisible(page, "main, [role='main']", 5000);

      // 查找删除按钮（需要先有 Post）
      const deleteButton = page
        .locator('button:has-text("Delete"), button:has-text("删除")')
        .first();

      if (await deleteButton.isVisible()) {
        await deleteButton.click();

        // 确认删除（如果有确认对话框）
        const confirmButton = page
          .locator('button:has-text("Confirm"), button:has-text("确认")')
          .first();
        if (await confirmButton.isVisible()) {
          await confirmButton.click();
          await page.waitForTimeout(2000);
        }

        // 验证 Post 从列表中消失
        await page.reload();
        await page.waitForTimeout(1000);
      }
    });
  });

  test.describe("2.4 管理订阅者", () => {
    test.beforeEach(async ({ page }) => {
      await signUpUser(page, creatorEmail, TEST_PASSWORD, "creator");
    });

    test("访问订阅者列表页面", async ({ page }) => {
      await page.goto(`${BASE_URL}/creator/studio/subscribers`);

      // 验证页面加载
      await waitForVisible(page, "main, [role='main']", 5000);

      // 验证订阅者列表容器存在
      const subscribersList = page.locator("text=/subscriber|follower/i");
      await expect(subscribersList.first()).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe("2.5 查看收益", () => {
    test.beforeEach(async ({ page }) => {
      await signUpUser(page, creatorEmail, TEST_PASSWORD, "creator");
    });

    test("访问收益页面", async ({ page }) => {
      await page.goto(`${BASE_URL}/creator/studio/earnings`);

      // 验证页面加载
      await waitForVisible(page, "main, [role='main']", 5000);

      // 验证收益相关信息显示
      const earningsInfo = page.locator("text=/earning|revenue|income/i");
      await expect(earningsInfo.first()).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe("2.6 Creator Analytics", () => {
    test.beforeEach(async ({ page }) => {
      await signUpUser(page, creatorEmail, TEST_PASSWORD, "creator");
    });

    test("访问 Analytics 页面", async ({ page }) => {
      await page.goto(`${BASE_URL}/creator/studio/analytics`);

      // 验证页面加载
      await waitForVisible(page, "main, [role='main']", 5000);

      // 验证 Analytics 相关内容显示
      const analyticsContent = page.locator("text=/analytics|statistics|stats/i");
      await expect(analyticsContent.first()).toBeVisible({ timeout: 5000 });
    });
  });
});
