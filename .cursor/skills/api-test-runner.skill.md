---
name: api-test-runner
description: 运行 API 集成测试，验证所有端点功能正常
triggers:
  - "运行 API 测试"
  - "测试 API 端点"
  - "验证 API 功能"
---

# API 测试运行器

## 功能说明

自动运行所有 API 集成测试，验证后端端点的功能正确性。

## 使用方式

```bash
# 运行所有 API 测试
pnpm test:integration

# 运行特定模块测试
pnpm vitest run tests/integration/api/posts.test.ts
pnpm vitest run tests/integration/api/paywall.test.ts
pnpm vitest run tests/integration/api/wallet.test.ts
```

## 测试覆盖范围

### 1. Posts API (`/api/posts`)

#### POST /api/posts
- ✅ 创建免费帖子
- ✅ 创建订阅帖子
- ✅ 创建 PPV 帖子（价格 >= $1.00）
- ❌ 拒绝 PPV 价格 < $1.00
- ❌ 拒绝未认证用户创建帖子

#### GET /api/posts/[id]
- ✅ 获取帖子详情
- ❌ 返回 404 对于不存在的帖子
- ✅ 根据权限返回不同内容（预览 vs 完整）

#### PUT /api/posts/[id]
- ✅ 更新帖子标题和内容
- ✅ 更新帖子可见性
- ❌ 拒绝非 Creator 更新

#### DELETE /api/posts/[id]/delete
- ✅ 删除帖子
- ❌ 拒绝非 Creator 删除

### 2. Paywall API

#### POST /api/subscribe
- ✅ 成功订阅 Creator
- ❌ 拒绝重复订阅
- ❌ 拒绝余额不足的订阅

#### POST /api/unlock
- ✅ 成功解锁 PPV 帖子
- ❌ 拒绝重复购买
- ❌ 拒绝余额不足的购买
- ✅ 正确扣除钱包余额
- ✅ 正确记录交易

#### GET /api/subscription/status
- ✅ 返回订阅状态
- ✅ 返回订阅到期时间

#### POST /api/subscription/cancel
- ✅ 取消订阅
- ❌ 拒绝取消不存在的订阅

### 3. Wallet API

#### GET /api/wallet/balance
- ✅ 返回用户钱包余额
- ✅ 返回 0 对于没有钱包的用户

#### GET /api/wallet/transactions
- ✅ 返回交易历史
- ✅ 按时间倒序排列
- ✅ 返回空数组对于没有交易的用户

### 4. Profile API

#### GET /api/profile
- ✅ 返回用户 profile
- ❌ 返回 401 对于未登录用户

#### PUT /api/profile/update
- ✅ 更新用户信息
- ✅ 更新头像
- ❌ 拒绝无效数据

### 5. Creator API

#### POST /api/creator/create
- ✅ 升级为 Creator
- ❌ 拒绝重复升级

#### GET /api/creator/[id]
- ✅ 返回 Creator 信息
- ❌ 返回 404 对于不存在的 Creator

## 测试流程

### 1. 前置准备
```typescript
beforeAll(async () => {
  // 创建测试用户和数据
  fixtures = await setupTestFixtures();
});
```

### 2. 执行测试
```typescript
it("should create free post", async () => {
  const response = await fetch(`${BASE_URL}/api/posts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      title: "Test Post",
      content: "Content",
      visibility: "free",
    }),
  });

  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.success).toBe(true);
});
```

### 3. 清理数据
```typescript
afterAll(async () => {
  await teardownTestFixtures(fixtures);
});
```

## 断言规范

### 成功响应
```typescript
expect(response.status).toBe(200);
expect(data.success).toBe(true);
expect(data.result).toBeDefined();
```

### 错误响应
```typescript
expect(response.status).toBe(400); // or 401, 404, 500
expect(data.success).toBe(false);
expect(data.error).toContain("Expected error message");
```

## 运行报告

测试完成后生成报告：
- 总测试数
- 通过数
- 失败数
- 覆盖率
- 执行时间

## 最佳实践

1. **独立性**：每个测试用例独立，不依赖其他用例
2. **清理**：测试后清理所有数据
3. **真实性**：使用真实的 HTTP 请求，不 Mock API
4. **完整性**：测试正常流程和异常流程
5. **性能**：使用 Admin API 创建数据，加快测试速度

## 故障排查

### 测试失败常见原因

1. **环境变量未配置**
   - 检查 `.env.local` 文件
   - 确保 `SUPABASE_SERVICE_ROLE_KEY` 已设置

2. **数据库状态不一致**
   - 清理残留测试数据
   - 重置数据库（如需要）

3. **网络问题**
   - 检查 Supabase 连接
   - 检查本地服务器是否运行

4. **权限问题**
   - 检查 RLS 策略
   - 检查用户角色

## 示例输出

```
✓ tests/integration/api/posts.test.ts (8)
  ✓ POST /api/posts (3)
    ✓ should create free post
    ✓ should validate PPV price >= $1.00
    ✓ should create valid PPV post
  ✓ GET /api/posts/[id] (2)
    ✓ should get post details
    ✓ should return 404 for non-existent post

Test Files  3 passed (3)
     Tests  24 passed (24)
  Start at  10:30:00
  Duration  5.23s
```
