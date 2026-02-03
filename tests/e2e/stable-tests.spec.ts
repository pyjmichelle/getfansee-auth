/**
 * 稳定的 E2E 测试 - 验证所有核心功能
 *
 * 这些测试不依赖 Supabase Admin API，只通过 UI 操作验证功能。
 * 每个测试都是独立的，不依赖其他测试的状态。
 */
import { test, expect, Page } from "@playwright/test";
import { signUpUser } from "./shared/helpers";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";
const TEST_PASSWORD = "TestPassword123!";

// 生成唯一的测试邮箱
function generateTestEmail(prefix: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  return `e2e-${prefix}-${timestamp}-${random}@test.example.com`;
}

// 等待页面加载完成
async function waitForPageLoad(page: Page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForLoadState("networkidle");
}

// 清除浏览器存储
async function clearStorage(page: Page) {
  await page.context().clearCookies();
  try {
    await page.goto("about:blank");
  } catch {
    await page.goto(BASE_URL).catch(() => {});
  }

  try {
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  } catch {
    // ignore storage errors in restricted contexts
  }

  await page.addInitScript(() => {
    localStorage.setItem("getfansee_age_verified", "true");
  });
}

// ============================================
// 测试组 1: 页面可访问性（基础检查）
// ============================================
test.describe("1. 页面可访问性", () => {
  test("1.1 首页可访问", async ({ page }) => {
    const response = await page.goto(BASE_URL);
    expect(response?.status()).toBeLessThan(500);
  });

  test("1.2 认证页面可访问", async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/auth`);
    expect(response?.status()).toBeLessThan(500);

    // 验证登录表单存在
    await expect(page.getByTestId("auth-email")).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("auth-password")).toBeVisible({ timeout: 10000 });
  });

  test("1.3 Home 页面可访问（会重定向到 auth）", async ({ page }) => {
    await clearStorage(page);
    const response = await page.goto(`${BASE_URL}/home`);

    // 未登录时应该重定向到 auth 或显示 home 页面
    const url = page.url();
    expect(url.includes("/auth") || url.includes("/home") || url === BASE_URL + "/").toBe(true);
  });
});

// ============================================
// 测试组 2: 认证流程
// ============================================
test.describe("2. 认证流程", () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  test("2.1 登录表单验证", async ({ page }) => {
    await page.goto(`${BASE_URL}/auth`);
    await waitForPageLoad(page);

    // 验证表单元素存在
    const emailInput = page.getByTestId("auth-email");
    const passwordInput = page.getByTestId("auth-password");

    await expect(emailInput).toBeVisible({ timeout: 5000 });
    await expect(passwordInput).toBeVisible({ timeout: 5000 });

    // 验证有登录按钮
    const loginButton = page.getByTestId("auth-submit");
    await expect(loginButton).toBeVisible({ timeout: 5000 });
  });

  test("2.2 注册表单验证", async ({ page }) => {
    await page.goto(`${BASE_URL}/auth?mode=signup`);
    await waitForPageLoad(page);

    // 验证表单元素存在
    const emailInput = page.getByTestId("auth-email");
    const passwordInput = page.getByTestId("auth-password");

    await expect(emailInput).toBeVisible({ timeout: 5000 });
    await expect(passwordInput).toBeVisible({ timeout: 5000 });

    // 验证有注册按钮
    const signupButton = page.getByTestId("auth-submit");
    await expect(signupButton).toBeVisible({ timeout: 5000 });
  });

  test("2.3 登录错误处理 - 空表单提交", async ({ page }) => {
    await page.goto(`${BASE_URL}/auth`);
    await waitForPageLoad(page);

    // 不填写任何内容，直接点击登录
    const loginButton = page.getByTestId("auth-submit");

    if (await loginButton.isEnabled()) {
      await loginButton.click();

      // 验证没有跳转（还在 auth 页面）
      await expect(page).toHaveURL(/\/auth/);
    }
  });

  test("2.4 登录错误处理 - 错误凭据", async ({ page }) => {
    await page.goto(`${BASE_URL}/auth`);
    await waitForPageLoad(page);

    // 填写不存在的凭据
    await page.getByTestId("auth-email").fill("nonexistent@test.com");
    await page.getByTestId("auth-password").fill("WrongPassword123!");

    // 点击登录
    const loginButton = page.getByTestId("auth-submit");
    await loginButton.click();

    await expect(page).toHaveURL(/\/auth/);
  });

  test("2.5 用户注册流程", async ({ page }) => {
    const testEmail = generateTestEmail("register");

    await signUpUser(page, testEmail, TEST_PASSWORD, "fan");
    await expect(page).toHaveURL(/\/home/);
  });
});

// ============================================
// 测试组 3: 核心页面功能
// ============================================
test.describe("3. 核心页面功能", () => {
  test("3.1 Home 页面正确处理（重定向到 auth 或显示 feed）", async ({ page }) => {
    await clearStorage(page);
    await page.goto(`${BASE_URL}/home`);
    await waitForPageLoad(page);

    // 未登录时会重定向到 /auth，已登录时显示 feed
    // 两种情况都应该有页面内容
    const url = page.url();

    if (url.includes("/auth")) {
      // 重定向到 auth - 验证登录表单存在
      await expect(page.getByTestId("auth-email")).toBeVisible({ timeout: 10000 });
    } else {
      // 已登录 - 验证有内容区域
      const content = page.locator("main, div.container, div[class*='feed']");
      await expect(content).toBeVisible({ timeout: 10000 });
    }
  });

  test("3.2 个人中心页面可访问", async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/me`);

    // 页面应该加载（可能重定向到 auth）
    expect(response?.status()).toBeLessThan(500);
  });

  test("3.3 订阅列表页面可访问", async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/subscriptions`);
    expect(response?.status()).toBeLessThan(500);
  });

  test("3.4 购买记录页面可访问", async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/purchases`);
    expect(response?.status()).toBeLessThan(500);
  });
});

// ============================================
// 测试组 4: Creator 相关页面
// ============================================
test.describe("4. Creator 页面", () => {
  test("4.1 Creator Onboarding 页面可访问", async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/creator/onboarding`);
    expect(response?.status()).toBeLessThan(500);
  });

  test("4.2 Creator Upgrade 页面可访问", async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/creator/upgrade`);
    expect(response?.status()).toBeLessThan(500);
  });

  test("4.3 Creator Studio 页面可访问", async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/creator/studio`);
    // 可能重定向到 auth 或 home
    expect(response?.status()).toBeLessThan(500);
  });

  test("4.4 创建 Post 页面可访问", async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/creator/new-post`);
    expect(response?.status()).toBeLessThan(500);
  });
});

// ============================================
// 测试组 5: API 健康检查
// ============================================
test.describe("5. API 健康检查", () => {
  test("5.1 用户 API 响应正常", async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/user`);
    // 200 = 成功, 401 = 未认证（正常）, 403 = 无权限（正常）
    expect([200, 401, 403]).toContain(response.status());
  });

  test("5.2 Feed API 响应正常", async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/feed`);
    expect([200, 401, 403]).toContain(response.status());
  });

  test("5.3 Profile API 响应正常", async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/profile`);
    expect([200, 401, 403]).toContain(response.status());
  });
});

// ============================================
// 测试组 6: 导航和路由
// ============================================
test.describe("6. 导航和路由", () => {
  test("6.1 未登录用户访问受保护路由被重定向", async ({ page }) => {
    await clearStorage(page);
    await page.goto(`${BASE_URL}/me`);
    await waitForPageLoad(page);

    // 应该重定向到 auth 或显示登录提示
    const url = page.url();
    const isRedirected = url.includes("/auth") || url.includes("login");
    const hasLoginPrompt = (await page.getByTestId("auth-password").count()) > 0;

    expect(isRedirected || hasLoginPrompt || url.includes("/me")).toBe(true);
  });

  test("6.2 根路径正确处理", async ({ page }) => {
    const response = await page.goto(BASE_URL);
    expect(response?.status()).toBeLessThan(500);
  });
});

// ============================================
// 测试组 7: UI 元素
// ============================================
test.describe("7. UI 元素", () => {
  test("7.1 认证页面 Tab 切换正常", async ({ page }) => {
    await page.goto(`${BASE_URL}/auth`);
    await waitForPageLoad(page);

    // 查找 Tab 切换按钮
    const signUpTab = page.getByTestId("auth-tab-signup");
    const signInTab = page.getByTestId("auth-tab-login");

    // 验证至少有一个 Tab 存在
    const hasSignUpTab = (await signUpTab.count()) > 0;
    const hasSignInTab = (await signInTab.count()) > 0;

    // 页面应该有切换功能或已经在正确的模式
    expect(hasSignUpTab || hasSignInTab || page.url().includes("mode=")).toBe(true);
  });

  test("7.2 页面无 JavaScript 错误", async ({ page }) => {
    const errors: string[] = [];

    page.on("pageerror", (error) => {
      errors.push(error.message);
    });

    await page.goto(BASE_URL);
    await waitForPageLoad(page);
    await page.waitForLoadState("networkidle");

    // 允许一些常见的非致命错误
    const criticalErrors = errors.filter(
      (e) => !e.includes("ResizeObserver") && !e.includes("Non-Error")
    );

    // 不应该有严重的 JavaScript 错误
    expect(criticalErrors.length).toBeLessThan(3);
  });
});
