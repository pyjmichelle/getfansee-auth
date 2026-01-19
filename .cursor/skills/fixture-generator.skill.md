---
name: fixture-generator
description: 生成测试数据 Fixtures，支持自定义用户、帖子、钱包等
triggers:
  - "生成测试数据"
  - "创建 Fixture"
  - "生成测试用户"
---

# Fixture 生成器

## 功能说明

快速生成各种类型的测试数据，用于单元测试、集成测试和 E2E 测试。

## 使用方式

```bash
# 生成完整的测试数据集
"生成完整测试数据"

# 生成特定类型的数据
"生成 Creator 用户"
"生成 Fan 用户并充值 $100"
"生成 PPV 帖子价格 $10"
```

## 支持的 Fixture 类型

### 1. 用户 Fixtures

#### Creator

```typescript
{
  userId: string,
  email: string,
  password: string,
  displayName: string,
  role: "creator",
  kycVerified: boolean
}
```

#### Fan

```typescript
{
  userId: string,
  email: string,
  password: string,
  walletBalance: number, // in cents
  role: "fan"
}
```

### 2. 帖子 Fixtures

#### 免费帖子

```typescript
{
  id: string,
  creatorId: string,
  title: string,
  content: string,
  visibility: "free",
  priceCents: null
}
```

#### 订阅帖子

```typescript
{
  id: string,
  creatorId: string,
  title: string,
  content: string,
  visibility: "subscribers",
  priceCents: null
}
```

#### PPV 帖子

```typescript
{
  id: string,
  creatorId: string,
  title: string,
  content: string,
  visibility: "ppv",
  priceCents: number // >= 100 ($1.00)
}
```

### 3. 订阅 Fixtures

```typescript
{
  id: string,
  fanId: string,
  creatorId: string,
  status: "active" | "canceled",
  currentPeriodEnd: string // ISO date
}
```

### 4. 购买 Fixtures

```typescript
{
  id: string,
  fanId: string,
  postId: string,
  priceCents: number
}
```

## 快速生成函数

### setupTestFixtures()

生成完整的测试数据集（1 Creator + 1 Fan + 3 Posts）

### createTestCreator(options?)

生成单个 Creator，可选参数：

- `displayName`: 自定义显示名称
- `kycVerified`: 是否通过 KYC（默认 true）

### createTestFan(walletBalance?)

生成单个 Fan，可选参数：

- `walletBalance`: 钱包余额（cents，默认 5000）

### createTestPost(creatorId, visibility, priceCents?)

生成单个帖子，必需参数：

- `creatorId`: Creator ID
- `visibility`: "free" | "subscribers" | "ppv"
- `priceCents`: PPV 价格（仅 PPV 帖子需要）

### topUpWallet(userId, amountCents)

为用户钱包充值

### createTestSubscription(fanId, creatorId)

创建订阅关系

### createTestPurchase(fanId, postId, priceCents)

创建购买记录

## 数据清理

### teardownTestFixtures(fixtures)

清理所有测试数据，包括：

- 删除帖子
- 删除订阅/购买记录
- 删除钱包交易
- 删除用户 profiles
- 删除 Auth 用户

## 最佳实践

1. **测试隔离**：每个测试用例使用独立的 Fixture
2. **时间戳**：使用时间戳确保邮箱唯一性
3. **清理**：测试结束后必须清理数据
4. **Admin API**：使用 Supabase Admin API 创建数据，绕过 UI 流程

## 示例

```typescript
import { setupTestFixtures, teardownTestFixtures } from "@/e2e/shared/fixtures";

describe("My Test", () => {
  let fixtures;

  beforeAll(async () => {
    fixtures = await setupTestFixtures();
  });

  afterAll(async () => {
    await teardownTestFixtures(fixtures);
  });

  it("should work", () => {
    expect(fixtures.creator.userId).toBeDefined();
    expect(fixtures.fan.walletBalance).toBe(5000);
    expect(fixtures.posts.ppv.priceCents).toBe(500);
  });
});
```
