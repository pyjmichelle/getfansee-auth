import { test, expect } from "@playwright/test";

/**
 * Phase 2 + Phase 3 E2E 测试
 * 覆盖：上传图片、上传视频、发布 post、feed 展示、locked 订阅后可见
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";

// 测试用户凭据（使用时间戳确保唯一性）
const timestamp = Date.now();
const random = Math.random().toString(36).slice(2, 8);
const uniqueSuffix = `${timestamp}-${random}`;
const fanEmail = `e2e-fan-${uniqueSuffix}@example.com`;
const fanPassword = "TestPassword123!";
const creatorEmail = `e2e-creator-${uniqueSuffix}@example.com`;
const creatorPassword = "CreatorPassword123!";

import { clearStorage, signUpUser, waitForPageLoad } from "./shared/helpers";

test.describe("Paywall Flow E2E", () => {
  test.beforeEach(async ({ page }) => {
    // 使用共享的 clearStorage 函数，它已经处理了 localStorage 访问错误
    await clearStorage(page);
  });

  test("完整流程：注册 → 成为 Creator → 上传图片 → 发布 locked post → 订阅 → 查看", async ({
    page,
  }) => {
    // 1. 注册 Fan 用户
    await signUpUser(page, fanEmail, fanPassword, "fan");
    await waitForPageLoad(page);

    // 2. 注册 Creator 用户（新标签页）
    const creatorPage = await page.context().newPage();
    await signUpUser(creatorPage, creatorEmail, creatorPassword, "creator");
    await waitForPageLoad(creatorPage);

    // 3. Creator 成为 Creator（如果按钮可见）
    await creatorPage.goto(`${BASE_URL}/me`);
    const becomeCreatorButton = creatorPage.getByTestId("become-creator-button");
    if (await becomeCreatorButton.isVisible()) {
      await becomeCreatorButton.click();
      await creatorPage
        .waitForURL(/\/creator\/(onboarding|upgrade)/, { timeout: 5000 })
        .catch(() => {});
    }

    await creatorPage.fill('input[name="display_name"]', `Creator ${uniqueSuffix}`);
    await creatorPage.fill('textarea[name="bio"]', "E2E Test Creator");
    await creatorPage.click('button:has-text("Save")');

    await creatorPage.waitForURL(`${BASE_URL}/home`, { timeout: 5000 });

    // 4. Creator 创建 Post（上传图片）
    await creatorPage.click('a[href="/creator/new-post"]');
    await creatorPage.waitForURL(`${BASE_URL}/creator/new-post`, { timeout: 5000 });

    // 上传图片
    const fileInput = creatorPage.getByTestId("upload-zone").locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "test-image.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from("fake-image-data"),
    });

    // 等待上传完成
    await creatorPage.waitForSelector('img[src*="supabase"]', { timeout: 30000 });

    // 填写 post 内容
    await creatorPage.getByTestId("post-content").fill(`E2E Test Post ${uniqueSuffix}`);

    // 设置为 locked
    await creatorPage.click('input[type="checkbox"][id="is_locked"]');

    // 发布
    await creatorPage.click('button:has-text("发布")');
    await creatorPage.waitForURL(`${BASE_URL}/home`, { timeout: 5000 });

    // 5. Fan 查看 Feed（应该看到 locked 遮罩）
    await page.goto(`${BASE_URL}/home`);
    await page.waitForSelector("text=E2E Test Post", { timeout: 10000 });

    // 验证 locked 内容不可见
    const lockedContent = page.getByTestId("post-locked-preview").first();
    await expect(lockedContent).toBeVisible();

    // 6. Fan 订阅 Creator
    const subscribeButton = page.getByTestId("creator-subscribe-button").first();
    if (await subscribeButton.isVisible()) {
      await subscribeButton.click();
      await expect(page.getByTestId("paywall-modal")).toBeVisible({ timeout: 10000 });
      await page.getByTestId("paywall-subscribe-button").click();
      await expect(page.getByTestId("paywall-success-message")).toBeVisible({ timeout: 15000 });
    }

    // 7. 验证 locked 内容现在可见
    await page.reload();
    await page.waitForSelector("text=E2E Test Post", { timeout: 10000 });

    // locked 遮罩应该消失
    await expect(lockedContent).not.toBeVisible({ timeout: 5000 });

    // 清理
    await creatorPage.close();
  });

  test("上传视频并发布", async ({ page }) => {
    // 简化版本：只测试上传功能
    await page.goto(`${BASE_URL}/auth?mode=login`);
    await waitForPageLoad(page);

    // 登录（假设用户已存在）
    await page.fill('input[type="email"]', creatorEmail);
    await page.fill('input[type="password"]', creatorPassword);
    await page
      .getByRole("button", { name: /sign in/i })
      .first()
      .click();

    await page.waitForURL(`${BASE_URL}/home`, { timeout: 10000 });

    // 进入创建 post 页面
    await page.goto(`${BASE_URL}/creator/new-post`);

    // 上传视频（模拟）
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "test-video.mp4",
      mimeType: "video/mp4",
      buffer: Buffer.from("fake-video-data"),
    });

    // 等待上传完成
    await page.waitForSelector('video[src*="supabase"]', { timeout: 30000 });

    // 验证视频元素存在
    const videoElement = page.locator("video");
    await expect(videoElement).toBeVisible();
  });
});
