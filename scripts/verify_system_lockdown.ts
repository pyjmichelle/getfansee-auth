/**
 * 系统逻辑锁死与视觉重塑 - 审计脚本
 * 验证"身份隔离"和"视图统一"逻辑
 */

import * as fs from "fs";
import * as path from "path";

interface TestResult {
  name: string;
  passed: boolean;
  details?: string;
}

const results: TestResult[] = [];

function recordTest(name: string, passed: boolean, details = "") {
  results.push({ name, passed, details });
  const icon = passed ? "✅" : "❌";
  console.log(`${icon} ${name}${details ? ` - ${details}` : ""}`);
}

async function main() {
  console.log("🔍 开始系统逻辑锁死审计...\n");

  // ============================================
  // 1. 身份隔离：检查所有隐私相关 API 使用 getSession()
  // ============================================
  console.log("📋 测试 1: 身份隔离 - 检查隐私相关 API 使用 getSession()\n");

  const privacyFiles = [
    "app/notifications/page.tsx",
    "app/subscriptions/page.tsx",
    "app/purchases/page.tsx",
    "app/me/page.tsx",
  ];

  for (const file of privacyFiles) {
    const filePath = path.join(process.cwd(), file);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      const hasGetSession = content.includes("getSession()");
      const hasMockData =
        content.includes("mockNotifications") ||
        content.includes("mockSubscriptions") ||
        content.includes("mockPurchases");

      recordTest(
        `${file} 使用 getSession()`,
        hasGetSession && !hasMockData,
        hasMockData
          ? "仍包含 Mock 数据"
          : hasGetSession
            ? "已使用 getSession()"
            : "未使用 getSession()"
      );
    }
  }

  // ============================================
  // 2. 退出登录：检查 Sign Out 功能
  // ============================================
  console.log("\n📋 测试 2: 退出登录 - 检查 Sign Out 功能\n");

  const navHeaderPath = path.join(process.cwd(), "components/nav-header.tsx");
  if (fs.existsSync(navHeaderPath)) {
    const content = fs.readFileSync(navHeaderPath, "utf-8");
    const hasSignOut =
      content.includes("Sign Out") ||
      content.includes("signOut") ||
      content.includes("handleSignOut");
    const hasLogOutIcon = content.includes("LogOut");

    recordTest(
      "NavHeader 包含 Sign Out 功能",
      hasSignOut && hasLogOutIcon,
      hasSignOut ? "已实现" : "未实现"
    );
  }

  // ============================================
  // 3. 统一视图：检查 Fan/Creator 切换开关已移除
  // ============================================
  console.log("\n📋 测试 3: 统一视图 - 检查 Fan/Creator 切换开关已移除\n");

  if (fs.existsSync(navHeaderPath)) {
    const content = fs.readFileSync(navHeaderPath, "utf-8");
    const hasRoleSwitch =
      content.includes("handleRoleSwitch") ||
      content.includes("View as Fan") ||
      content.includes("viewAs");
    const hasFanCreatorToggle =
      content.includes("Fan") && content.includes("Creator") && content.includes("toggle");

    recordTest(
      "NavHeader 已移除 Fan/Creator 切换开关",
      !hasRoleSwitch && !hasFanCreatorToggle,
      hasRoleSwitch || hasFanCreatorToggle ? "仍包含切换开关" : "已移除"
    );
  }

  // ============================================
  // 4. 权限校验：检查 creator 自动解锁自己的内容
  // ============================================
  console.log("\n📋 测试 4: 权限校验 - 检查 creator 自动解锁自己的内容\n");

  const postsPath = path.join(process.cwd(), "lib/posts.ts");
  if (fs.existsSync(postsPath)) {
    const content = fs.readFileSync(postsPath, "utf-8");
    const hasAutoUnlock =
      content.includes("creatorId === userId") ||
      content.includes("creator_id === user.id") ||
      content.includes("自适应权限");

    recordTest(
      "lib/posts.ts 实现 creator 自动解锁",
      hasAutoUnlock,
      hasAutoUnlock ? "已实现" : "未实现"
    );
  }

  // ============================================
  // 5. 导航栏：检查 Become a Creator 按钮逻辑
  // ============================================
  console.log("\n📋 测试 5: 导航栏 - 检查 Become a Creator 按钮逻辑\n");

  if (fs.existsSync(navHeaderPath)) {
    const content = fs.readFileSync(navHeaderPath, "utf-8");
    const hasBecomeCreator =
      content.includes("Become a Creator") || content.includes("showBecomeCreator");
    const hasCondition = content.includes("!isCreator") || content.includes('role !== "creator"');

    recordTest(
      "NavHeader Become a Creator 按钮条件正确",
      hasBecomeCreator && hasCondition,
      hasBecomeCreator && hasCondition ? "条件正确" : "条件不正确"
    );
  }

  // ============================================
  // 6. 功能精简：检查 Comment 功能已隐藏
  // ============================================
  console.log("\n📋 测试 6: 功能精简 - 检查 Comment 功能已隐藏\n");

  const homePath = path.join(process.cwd(), "app/home/page.tsx");
  if (fs.existsSync(homePath)) {
    const content = fs.readFileSync(homePath, "utf-8");
    const hasComment =
      content.includes("MessageCircle") && !content.includes("Comment 功能已全局隐藏");
    const hasCommentHidden =
      content.includes("Comment 功能已全局隐藏") || content.includes("Comment 功能已隐藏");

    recordTest(
      "Home 页面 Comment 功能已隐藏",
      !hasComment || hasCommentHidden,
      hasCommentHidden ? "已隐藏" : hasComment ? "仍显示" : "未找到"
    );
  }

  // ============================================
  // 7. 财务预留：检查 referrer_id 字段
  // ============================================
  console.log("\n📋 测试 7: 财务预留 - 检查 referrer_id 字段\n");

  const migrationPath = path.join(process.cwd(), "migrations/017_system_lockdown.sql");
  if (fs.existsSync(migrationPath)) {
    const content = fs.readFileSync(migrationPath, "utf-8");
    const hasReferrerId = content.includes("referrer_id");

    recordTest("迁移文件包含 referrer_id 字段", hasReferrerId, hasReferrerId ? "已包含" : "未包含");
  }

  const referralPath = path.join(process.cwd(), "lib/referral.ts");
  if (fs.existsSync(referralPath)) {
    recordTest("lib/referral.ts 存在", true, "已创建");
  }

  // ============================================
  // 8. 订阅管理：检查 cancelled_at 显示
  // ============================================
  console.log("\n📋 测试 8: 订阅管理 - 检查 cancelled_at 显示\n");

  const subscriptionsPath = path.join(process.cwd(), "app/subscriptions/page.tsx");
  if (fs.existsSync(subscriptionsPath)) {
    const content = fs.readFileSync(subscriptionsPath, "utf-8");
    const hasCancelledAt = content.includes("cancelled_at");
    const hasDisplay = content.includes("Cancelled on") || content.includes("cancelled_at");

    recordTest(
      "订阅管理页显示 cancelled_at",
      hasCancelledAt && hasDisplay,
      hasCancelledAt && hasDisplay ? "已实现" : "未实现"
    );
  }

  // ============================================
  // 汇总结果
  // ============================================
  console.log("\n" + "=".repeat(50));
  console.log("📊 测试结果汇总");
  console.log("=".repeat(50));

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;

  console.log(`总测试数: ${total}`);
  console.log(`✅ 通过: ${passed}`);
  console.log(`❌ 失败: ${failed}`);
  console.log("");

  if (failed === 0) {
    console.log("🎉 所有测试通过！系统逻辑锁死与视觉重塑已完成。");
    process.exit(0);
  } else {
    console.log("⚠️  部分测试失败，请检查上述错误。");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("❌ 审计脚本执行失败:", err);
  process.exit(1);
});
