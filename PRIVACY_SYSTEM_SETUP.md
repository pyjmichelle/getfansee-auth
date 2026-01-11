# 隐私系统设置指南

## 📋 前置条件

### 1. 执行数据库迁移

在 Supabase Dashboard SQL Editor 中执行：

```sql
-- 执行 migrations/015_geo_blocking_kyc.sql
```

这个迁移文件会：

- 在 `profiles` 表中添加 `blocked_countries` 字段（text[] 数组类型）

### 2. 验证迁移成功

执行以下 SQL 验证：

```sql
-- 检查字段是否存在
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name = 'blocked_countries';
```

**预期结果**：应该看到 `blocked_countries` 字段，类型为 `ARRAY`。

## 🧪 运行自动化审计

执行以下命令：

```bash
pnpm test:privacy
```

### 测试场景

#### 场景 A：地理屏蔽逻辑

- 创建创作者，屏蔽日本 (JP)
- 验证日本访客无法获取该创作者的内容
- 验证美国访客可以正常获取内容
- 验证 Feed 中不包含被屏蔽 creator 的内容

#### 场景 B：KYC 拦截逻辑

- 创建未完成 KYC 的创作者（age_verified = false）
- 验证无法创建 PPV post
- 验证无法创建订阅者专享 post
- 验证可以创建免费 post（不受 KYC 限制）

#### 场景 C：普通用户不受地理屏蔽限制

- 创建不屏蔽任何国家的创作者
- 验证所有国家的访客都可以访问内容

## ✅ 预期结果

所有测试应该通过：

```
============================================================
📊 测试结果汇总
============================================================
总计: X 个测试
✅ 通过: X
❌ 失败: 0

============================================================
✅ 审计通过 - 所有测试通过
```

## 🔧 功能说明

### 地理屏蔽 (Geo-Blocking)

**实现位置**：

- `lib/geo-utils.ts` - 获取访客国家和检查屏蔽逻辑
- `lib/posts.ts` - `listFeed()` 和 `listCreatorPosts()` 函数

**工作原理**：

1. 从请求头获取访客国家代码（优先使用 `x-vercel-ip-country`）
2. 查询 creator 的 `blocked_countries` 字段
3. 如果访客国家在屏蔽列表中，不返回该 creator 的任何内容

**使用方式**：

```typescript
// 在 Server Component 或 API Route 中
import { listFeed } from "@/lib/posts";
import { headers } from "next/headers";

const headersList = await headers();
const country = headersList.get("x-vercel-ip-country");

const posts = await listFeed(20, country); // 传入国家代码
```

### KYC 状态拦截

**实现位置**：

- `lib/kyc-service.ts` - KYC 状态检查函数
- `lib/posts.ts` - `createPost()` 函数

**工作原理**：

1. 在创建 PPV 或订阅者专享内容时，检查 `profiles.age_verified`
2. 如果 `age_verified = false`，拒绝创建并返回 null
3. 免费内容不受 KYC 限制

**预留接口**：

- `lib/kyc-service.ts` 中的 `checkKYCStatus()` 和 `updateKYCStatus()` 函数
- `/api/webhooks/didit` 路由（预留 Didit SDK 接入槽位）

## 📝 故障排除

### 错误：`column profiles.blocked_countries does not exist`

**原因**：未执行数据库迁移

**解决**：执行 `migrations/015_geo_blocking_kyc.sql`

### 错误：地理屏蔽未生效

**可能原因**：

1. `blocked_countries` 字段未正确设置
2. 访客国家代码获取失败

**解决**：

1. 检查 creator 的 `blocked_countries` 字段是否正确设置
2. 检查请求头中是否包含 `x-vercel-ip-country`
3. 在测试中手动传入国家代码：`listCreatorPosts(creatorId, "JP")`

### 错误：KYC 拦截未生效

**可能原因**：

1. `age_verified` 字段未正确设置
2. 创建的是免费内容（不受 KYC 限制）

**解决**：

1. 确保创建 PPV 或订阅者专享内容时，`age_verified = false`
2. 检查 `createPost()` 函数的日志输出

## 🎯 下一步

1. **执行迁移**：`migrations/015_geo_blocking_kyc.sql`
2. **运行测试**：`pnpm test:privacy`
3. **接入 Didit SDK**：在 `lib/kyc-service.ts` 和 `/api/webhooks/didit` 中实现真实 KYC 逻辑
