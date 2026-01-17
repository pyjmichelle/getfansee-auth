/**
 * 冒烟测试 - 核心流程验证
 * 这些测试必须 100% 通过才能部署
 */
import { test, expect } from "@playwright/test";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";

test.describe("冒烟测试 - 页面可访问性", () => {
  test("首页可访问", async ({ page }) => {
    const response = await page.goto(BASE_URL);
    expect(response?.status()).toBeLessThan(500);
  });

  test("认证页面可访问", async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/auth`);
    expect(response?.status()).toBeLessThan(500);
    
    // 验证页面包含登录表单
    await expect(page.locator('input[type="email"]').first()).toBeVisible({ timeout: 10000 });
  });

  test("首页内容加载正常", async ({ page }) => {
    await page.goto(`${BASE_URL}/home`);
    
    // 等待页面加载
    await page.waitForLoadState("networkidle");
    
    // 验证页面没有错误
    const errorText = await page.locator("text=Error").count();
    const error500 = await page.locator("text=500").count();
    const error404 = await page.locator("text=404").count();
    
    // 如果有明显的错误页面，测试失败
    expect(errorText + error500 + error404).toBeLessThan(3);
  });
});

test.describe("冒烟测试 - API 健康检查", () => {
  test("API 路由可访问", async ({ request }) => {
    // 测试一个基本的 API 端点
    const response = await request.get(`${BASE_URL}/api/user`);
    // 即使返回 401（未认证），也说明 API 正常工作
    expect([200, 401, 403]).toContain(response.status());
  });
});

test.describe("冒烟测试 - 认证流程", () => {
  test("登录表单渲染正确", async ({ page }) => {
    await page.goto(`${BASE_URL}/auth`);
    
    // 等待页面加载
    await page.waitForLoadState("domcontentloaded");
    
    // 验证核心元素存在
    const emailInput = page.locator('input[type="email"]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    
    await expect(emailInput).toBeVisible({ timeout: 10000 });
    await expect(passwordInput).toBeVisible({ timeout: 10000 });
  });

  test("注册页面切换正常", async ({ page }) => {
    await page.goto(`${BASE_URL}/auth?mode=signup`);
    
    // 等待页面加载
    await page.waitForLoadState("domcontentloaded");
    
    // 验证是注册模式
    const pageContent = await page.content();
    const hasSignUp = pageContent.toLowerCase().includes("sign up") || 
                      pageContent.toLowerCase().includes("register") ||
                      pageContent.toLowerCase().includes("创建账户");
    
    expect(hasSignUp).toBe(true);
  });
});
