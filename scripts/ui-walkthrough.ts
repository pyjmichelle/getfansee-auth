#!/usr/bin/env tsx

/**
 * UI Walkthrough Script
 * 自动化 UI 走查,截图所有页面并生成报告
 */

import { execSync } from "child_process";
import { existsSync, mkdirSync, copyFileSync, readdirSync } from "fs";
import { join } from "path";

const SCREENSHOT_DIR =
  "/Users/puyijun/Downloads/authentication-flow-design (1)/docs/reports/walkthrough-screenshots";
const TEMP_SCREENSHOT_DIR = "/var/folders/s6/3bm11tf51yng3kp878_9wmgw0000gn/T/cursor/screenshots";

// 确保截图目录存在
if (!existsSync(SCREENSHOT_DIR)) {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

interface PageConfig {
  url: string;
  name: string;
  requiresAuth?: boolean;
  description: string;
}

const MOBILE_PAGES: PageConfig[] = [
  { url: "http://localhost:3000/auth", name: "auth", description: "登录/注册页面" },
  { url: "http://localhost:3000/home", name: "home", requiresAuth: true, description: "首页 Feed" },
  {
    url: "http://localhost:3000/search",
    name: "search",
    requiresAuth: true,
    description: "搜索/发现页",
  },
  {
    url: "http://localhost:3000/notifications",
    name: "notifications",
    requiresAuth: true,
    description: "通知页",
  },
  { url: "http://localhost:3000/me", name: "me", requiresAuth: true, description: "用户中心" },
  {
    url: "http://localhost:3000/me/wallet",
    name: "me-wallet",
    requiresAuth: true,
    description: "钱包页",
  },
  {
    url: "http://localhost:3000/subscriptions",
    name: "subscriptions",
    requiresAuth: true,
    description: "订阅列表",
  },
  {
    url: "http://localhost:3000/purchases",
    name: "purchases",
    requiresAuth: true,
    description: "购买历史",
  },
  {
    url: "http://localhost:3000/creator/onboarding",
    name: "creator-onboarding",
    requiresAuth: true,
    description: "创作者引导",
  },
  {
    url: "http://localhost:3000/creator/studio",
    name: "creator-studio",
    requiresAuth: true,
    description: "Studio 首页",
  },
  {
    url: "http://localhost:3000/creator/studio/analytics",
    name: "creator-studio-analytics",
    requiresAuth: true,
    description: "数据分析",
  },
  {
    url: "http://localhost:3000/creator/studio/earnings",
    name: "creator-studio-earnings",
    requiresAuth: true,
    description: "收益",
  },
  {
    url: "http://localhost:3000/creator/new-post",
    name: "creator-new-post",
    requiresAuth: true,
    description: "新建帖子",
  },
  { url: "http://localhost:3000/terms", name: "terms", description: "服务条款" },
  { url: "http://localhost:3000/privacy", name: "privacy", description: "隐私政策" },
  {
    url: "http://localhost:3000/admin",
    name: "admin",
    requiresAuth: true,
    description: "管理后台",
  },
];

const PC_PAGES: PageConfig[] = [
  { url: "http://localhost:3000/auth", name: "auth", description: "登录/注册页面" },
  { url: "http://localhost:3000/home", name: "home", requiresAuth: true, description: "首页 Feed" },
  {
    url: "http://localhost:3000/search",
    name: "search",
    requiresAuth: true,
    description: "搜索/发现页",
  },
  { url: "http://localhost:3000/me", name: "me", requiresAuth: true, description: "用户中心" },
  {
    url: "http://localhost:3000/creator/studio",
    name: "creator-studio",
    requiresAuth: true,
    description: "Studio 首页",
  },
];

interface WalkthroughResult {
  page: string;
  status: "success" | "warning" | "error";
  issues: string[];
  screenshot: string;
}

const results: WalkthroughResult[] = [];

function captureScreenshot(
  url: string,
  filename: string,
  width: number,
  height: number
): WalkthroughResult {
  console.log(`📸 截图: ${filename} (${width}x${height})`);

  const result: WalkthroughResult = {
    page: filename,
    status: "success",
    issues: [],
    screenshot: `${filename}.png`,
  };

  try {
    // 使用 Playwright 截图
    const script = `
      const { chromium } = require('playwright');
      (async () => {
        const browser = await chromium.launch();
        const context = await browser.newContext({
          viewport: { width: ${width}, height: ${height} },
          deviceScaleFactor: 2
        });
        const page = await context.newPage();
        
        // 监听控制台错误
        const errors = [];
        page.on('console', msg => {
          if (msg.type() === 'error') {
            errors.push(msg.text());
          }
        });
        
        await page.goto('${url}', { waitUntil: 'networkidle' });
        await page.waitForTimeout(2000);
        
        await page.screenshot({ 
          path: '${SCREENSHOT_DIR}/${filename}.png',
          fullPage: true
        });
        
        if (errors.length > 0) {
          console.log('ERRORS:', JSON.stringify(errors));
        }
        
        await browser.close();
      })();
    `;

    execSync(`node -e "${script.replace(/"/g, '\\"')}"`, {
      stdio: "pipe",
      encoding: "utf-8",
    });

    console.log(`  ✅ 截图成功: ${filename}.png`);
  } catch (error: any) {
    console.error(`  ❌ 截图失败: ${error.message}`);
    result.status = "error";
    result.issues.push(`截图失败: ${error.message}`);
  }

  return result;
}

async function main() {
  console.log("🚀 开始 UI 走查\n");
  console.log("=".repeat(60));

  // Mobile 走查
  console.log("\n📱 Mobile 走查 (375x812)");
  console.log("-".repeat(60));

  for (const page of MOBILE_PAGES) {
    const result = captureScreenshot(page.url, `mb-${page.name}`, 375, 812);
    results.push(result);
  }

  // PC 走查
  console.log("\n💻 PC 走查 (1440x900)");
  console.log("-".repeat(60));

  for (const page of PC_PAGES) {
    const result = captureScreenshot(page.url, `pc-${page.name}`, 1440, 900);
    results.push(result);
  }

  // 生成报告
  console.log("\n" + "=".repeat(60));
  console.log("📊 走查报告");
  console.log("=".repeat(60));

  const successCount = results.filter((r) => r.status === "success").length;
  const warningCount = results.filter((r) => r.status === "warning").length;
  const errorCount = results.filter((r) => r.status === "error").length;

  console.log(`\n总计: ${results.length} 个页面`);
  console.log(`✅ 成功: ${successCount}`);
  console.log(`⚠️  警告: ${warningCount}`);
  console.log(`❌ 错误: ${errorCount}`);

  if (errorCount > 0) {
    console.log("\n❌ 失败的页面:");
    results
      .filter((r) => r.status === "error")
      .forEach((r) => {
        console.log(`  - ${r.page}`);
        r.issues.forEach((issue) => console.log(`    • ${issue}`));
      });
  }

  if (warningCount > 0) {
    console.log("\n⚠️  有问题的页面:");
    results
      .filter((r) => r.status === "warning")
      .forEach((r) => {
        console.log(`  - ${r.page}`);
        r.issues.forEach((issue) => console.log(`    • ${issue}`));
      });
  }

  console.log(`\n📁 截图保存位置: ${SCREENSHOT_DIR}`);
  console.log("\n✨ 走查完成!\n");
}

main().catch(console.error);
