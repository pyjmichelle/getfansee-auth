#!/usr/bin/env node

/**
 * UI Walkthrough Script - 简化版
 * 使用 Playwright 自动截图所有页面
 */

import { chromium } from 'playwright';
import { mkdirSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';

const SCREENSHOT_DIR = '/Users/puyijun/Downloads/authentication-flow-design (1)/docs/reports/walkthrough-screenshots';
const BASE_URL = 'http://localhost:3000';

// 确保目录存在
if (!existsSync(SCREENSHOT_DIR)) {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const MOBILE_PAGES = [
  { url: '/auth', name: 'auth', desc: '登录/注册页面' },
  { url: '/home', name: 'home', desc: '首页 Feed' },
  { url: '/search', name: 'search', desc: '搜索/发现页' },
  { url: '/notifications', name: 'notifications', desc: '通知页' },
  { url: '/me', name: 'me', desc: '用户中心' },
  { url: '/me/wallet', name: 'me-wallet', desc: '钱包页' },
  { url: '/subscriptions', name: 'subscriptions', desc: '订阅列表' },
  { url: '/purchases', name: 'purchases', desc: '购买历史' },
  { url: '/creator/onboarding', name: 'creator-onboarding', desc: '创作者引导' },
  { url: '/creator/studio', name: 'creator-studio', desc: 'Studio 首页' },
  { url: '/creator/studio/analytics', name: 'creator-studio-analytics', desc: '数据分析' },
  { url: '/creator/studio/earnings', name: 'creator-studio-earnings', desc: '收益' },
  { url: '/creator/new-post', name: 'creator-new-post', desc: '新建帖子' },
  { url: '/terms', name: 'terms', desc: '服务条款' },
  { url: '/privacy', name: 'privacy', desc: '隐私政策' },
  { url: '/dmca', name: 'dmca', desc: 'DMCA 政策' },
  { url: '/admin', name: 'admin', desc: '管理后台' },
];

const PC_PAGES = [
  { url: '/auth', name: 'auth', desc: '登录/注册页面' },
  { url: '/home', name: 'home', desc: '首页 Feed' },
  { url: '/search', name: 'search', desc: '搜索/发现页' },
  { url: '/me', name: 'me', desc: '用户中心' },
  { url: '/creator/studio', name: 'creator-studio', desc: 'Studio 首页' },
];

const results = [];

async function captureScreenshot(page, url, filename, desc) {
  console.log(`📸 ${desc} - ${filename}`);
  
  const result = {
    page: filename,
    url,
    desc,
    status: 'success',
    issues: [],
    consoleErrors: [],
    actualUrl: '',
  };

  try {
    // 监听控制台错误
    page.on('console', msg => {
      if (msg.type() === 'error') {
        result.consoleErrors.push(msg.text());
      }
    });

    // 导航到页面
    await page.goto(`${BASE_URL}${url}`, { 
      waitUntil: 'networkidle',
      timeout: 10000 
    });
    
    // 等待页面稳定
    await page.waitForTimeout(2000);
    
    // 记录实际 URL (可能被重定向)
    result.actualUrl = page.url();
    
    // 检查是否被重定向
    if (result.actualUrl !== `${BASE_URL}${url}`) {
      result.issues.push(`重定向: ${url} → ${result.actualUrl.replace(BASE_URL, '')}`);
      result.status = 'warning';
    }
    
    // 截图
    await page.screenshot({ 
      path: join(SCREENSHOT_DIR, `${filename}.png`),
      fullPage: true
    });
    
    // 检查控制台错误
    if (result.consoleErrors.length > 0) {
      result.issues.push(`${result.consoleErrors.length} 个控制台错误`);
      if (result.status === 'success') {
        result.status = 'warning';
      }
    }
    
    console.log(`  ✅ 成功`);
  } catch (error) {
    console.error(`  ❌ 失败: ${error.message}`);
    result.status = 'error';
    result.issues.push(`截图失败: ${error.message}`);
  }

  return result;
}

async function main() {
  console.log('🚀 开始 UI 走查\n');
  console.log('='.repeat(70));

  const browser = await chromium.launch({ 
    headless: true 
  });

  // Mobile 走查
  console.log('\n📱 Mobile 走查 (375x812)');
  console.log('-'.repeat(70));
  
  const mobileContext = await browser.newContext({
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 2,
  });
  const mobilePage = await mobileContext.newPage();
  
  for (const pageConfig of MOBILE_PAGES) {
    const result = await captureScreenshot(
      mobilePage,
      pageConfig.url,
      `mb-${pageConfig.name}`,
      pageConfig.desc
    );
    results.push(result);
  }
  
  await mobileContext.close();

  // PC 走查
  console.log('\n💻 PC 走查 (1440x900)');
  console.log('-'.repeat(70));
  
  const pcContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const pcPage = await pcContext.newPage();
  
  for (const pageConfig of PC_PAGES) {
    const result = await captureScreenshot(
      pcPage,
      pageConfig.url,
      `pc-${pageConfig.name}`,
      pageConfig.desc
    );
    results.push(result);
  }
  
  await pcContext.close();
  await browser.close();

  // 生成报告
  console.log('\n' + '='.repeat(70));
  console.log('📊 走查报告');
  console.log('='.repeat(70));

  const successCount = results.filter(r => r.status === 'success').length;
  const warningCount = results.filter(r => r.status === 'warning').length;
  const errorCount = results.filter(r => r.status === 'error').length;

  console.log(`\n总计: ${results.length} 个页面`);
  console.log(`✅ 成功: ${successCount}`);
  console.log(`⚠️  警告: ${warningCount}`);
  console.log(`❌ 错误: ${errorCount}`);

  // 详细问题列表
  if (warningCount > 0) {
    console.log('\n⚠️  有警告的页面:');
    results
      .filter(r => r.status === 'warning')
      .forEach(r => {
        console.log(`\n  ${r.page} - ${r.desc}`);
        r.issues.forEach(issue => console.log(`    • ${issue}`));
      });
  }

  if (errorCount > 0) {
    console.log('\n❌ 失败的页面:');
    results
      .filter(r => r.status === 'error')
      .forEach(r => {
        console.log(`\n  ${r.page} - ${r.desc}`);
        r.issues.forEach(issue => console.log(`    • ${issue}`));
      });
  }

  // 保存 JSON 报告
  const reportPath = join(SCREENSHOT_DIR, 'walkthrough-report.json');
  writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\n📄 详细报告: ${reportPath}`);
  console.log(`📁 截图目录: ${SCREENSHOT_DIR}`);
  console.log('\n✨ 走查完成!\n');
}

main().catch(console.error);
