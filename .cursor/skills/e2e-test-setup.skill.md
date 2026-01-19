---
name: e2e-test-setup
description: 设置 E2E 测试环境，包括环境变量、数据库连接、测试用户
triggers:
  - "设置 E2E 测试"
  - "准备测试环境"
  - "初始化测试数据"
---

# E2E 测试环境设置

## 功能说明

自动设置 E2E 测试所需的完整环境，包括：

- 验证环境变量配置
- 创建测试用户（Creator 和 Fan）
- 初始化测试数据（帖子、钱包余额）
- 配置 Playwright 测试模式

## 使用方式

```bash
# 触发此 Skill
"设置 E2E 测试环境"
```

## 执行步骤

### 1. 验证环境变量

检查以下环境变量是否已配置：

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_TEST_MODE=true`

### 2. 创建测试用户

使用 `e2e/shared/fixtures.ts` 中的 `setupTestFixtures()` 函数：

- 创建 1 个 Creator（已验证 KYC）
- 创建 1 个 Fan（钱包余额 $50）

### 3. 创建测试帖子

为 Creator 创建 3 种类型的帖子：

- 免费帖子（visibility: "free"）
- 订阅帖子（visibility: "subscribers"）
- PPV 帖子（visibility: "ppv", price: $5.00）

### 4. 注入测试 Cookie

使用 `injectTestCookie(page)` 函数为 Playwright 页面注入测试模式 cookie：

```typescript
await page.context().addCookies([
  {
    name: "playwright-test-mode",
    value: "1",
    domain: "localhost",
    path: "/",
  },
]);
```

### 5. 验证设置成功

- 检查用户是否成功创建
- 检查帖子是否成功创建
- 检查钱包余额是否正确

## 输出

返回测试数据对象：

```typescript
{
  creator: { userId, email, password, displayName },
  fan: { userId, email, password, walletBalance },
  posts: { free, subscribers, ppv }
}
```

## 清理

测试完成后，使用 `teardownTestFixtures(fixtures)` 清理所有测试数据。

## 注意事项

- 确保 Supabase 项目已关闭邮箱验证（或使用 Admin API 自动确认）
- 测试用户的邮箱格式为 `e2e-{role}-{timestamp}@example.com`
- 所有测试数据都应在测试结束后清理
