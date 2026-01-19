# MVP 修复计划

**生成时间**: 2026-01-17
**优先级排序**: P0 → P1 → P2

---

## P0 - 阻塞性错误（必须立即修复）

### 🔴 [P0-001] 修复 profiles 表 schema 问题

**问题**: `column profiles.username does not exist`

**影响**:

- Creator 查询失败
- 无法验证 Creator 收益
- 可能影响用户资料显示

**修复步骤**:

1. 检查 `profiles` 表的实际 schema:

   ```sql
   SELECT column_name, data_type
   FROM information_schema.columns
   WHERE table_name = 'profiles' AND table_schema = 'public';
   ```

2. 确认正确的用户名字段（可能是 `display_name` 或其他）

3. 更新以下文件中的字段引用:
   - `scripts/data-integrity-check.ts` (line 198)
   - 任何其他引用 `profiles.username` 的代码

4. 如果确实缺少 `username` 字段，执行 migration:

   ```sql
   ALTER TABLE public.profiles
   ADD COLUMN IF NOT EXISTS username text UNIQUE;

   -- 从 display_name 复制数据（如果需要）
   UPDATE public.profiles
   SET username = LOWER(REPLACE(display_name, ' ', '_'))
   WHERE username IS NULL;
   ```

**预计时间**: 30 分钟

---

### 🔴 [P0-002] 修复购买记录与交易记录不匹配

**问题**: 20 条购买记录中，0 条有匹配的交易记录

**影响**:

- 购买历史与交易记录不一致
- 可能导致退款/对账问题
- Creator 收益统计不准确

**根本原因分析**:

1. `rpc_purchase_post` 函数可能没有正确插入 `transactions` 记录
2. `metadata` 字段的 JSON 结构可能不正确
3. 查询条件可能不匹配

**修复步骤**:

#### 步骤 1: 验证 `rpc_purchase_post` 函数

```sql
-- 查看函数定义
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'rpc_purchase_post';
```

检查函数是否:

- ✅ 插入 `transactions` 记录
- ✅ 设置正确的 `type='ppv_purchase'`
- ✅ 设置正确的 `metadata` JSON 结构

#### 步骤 2: 检查现有数据

```sql
-- 查看所有交易记录
SELECT id, user_id, type, amount_cents, metadata, created_at
FROM public.transactions
WHERE type = 'ppv_purchase'
ORDER BY created_at DESC
LIMIT 10;

-- 查看所有购买记录
SELECT id, fan_id, post_id, paid_amount_cents, created_at
FROM public.purchases
ORDER BY created_at DESC
LIMIT 10;
```

#### 步骤 3: 补充缺失的交易记录

如果购买记录存在但交易记录缺失，执行数据修复:

```sql
-- 为每条购买记录创建对应的交易记录
INSERT INTO public.transactions (
  id,
  user_id,
  type,
  amount_cents,
  status,
  metadata,
  created_at
)
SELECT
  gen_random_uuid(),
  p.fan_id,
  'ppv_purchase',
  -p.paid_amount_cents,
  'completed',
  jsonb_build_object(
    'post_id', p.post_id,
    'creator_id', posts.creator_id,
    'purchase_id', p.id
  ),
  p.created_at
FROM public.purchases p
JOIN public.posts ON posts.id = p.post_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.transactions t
  WHERE t.user_id = p.fan_id
    AND t.type = 'ppv_purchase'
    AND t.metadata->>'post_id' = p.post_id::text
);
```

#### 步骤 4: 更新数据完整性检查脚本

修改 `scripts/data-integrity-check.ts` 的查询条件:

```typescript
// 当前查询（可能有问题）
.contains("metadata", { post_id: purchase.post_id });

// 改为更精确的查询
.filter(`metadata->>'post_id' = '${purchase.post_id}'`);
```

#### 步骤 5: 验证修复

```bash
pnpm tsx scripts/data-integrity-check.ts
```

**预计时间**: 1-2 小时

---

### 🔴 [P0-003] 解决 Playwright 浏览器安装问题

**问题**: `Executable doesn't exist at /Users/puyijun/Library/Caches/ms-playwright/chromium_headless_shell-1200/`

**影响**: 无法运行自动化 E2E 测试

**修复步骤**:

#### 方案 A: 强制重新安装 Playwright

```bash
# 清理缓存
rm -rf /Users/puyijun/Library/Caches/ms-playwright

# 重新安装
pnpm exec playwright install --force chromium

# 或安装所有浏览器
pnpm exec playwright install --force --with-deps
```

#### 方案 B: 使用 headed 模式

修改 `playwright.config.ts`:

```typescript
use: {
  headless: false, // 改为 false
  // ...
}
```

#### 方案 C: 使用本地 Chrome

```typescript
use: {
  channel: 'chrome', // 使用系统安装的 Chrome
  // ...
}
```

#### 方案 D: 手动测试（临时方案）

如果自动化测试仍无法运行，使用手动测试清单（见 `TEST_SUMMARY.md`）

**预计时间**: 30 分钟

---

## P1 - 严重错误（影响用户体验）

### 🟡 [P1-001] 完成核心旅程验证

**问题**: E2E 测试无法运行，核心功能未经验证

**修复步骤**:

1. **修复 Playwright 后重新运行测试**:

   ```bash
   export PLAYWRIGHT_BASE_URL="https://mvp.getfansee.com"
   pnpm playwright test tests/e2e/money-flow.spec.ts --project=chromium
   pnpm playwright test tests/e2e/sprint4-mvp.spec.ts --project=chromium
   ```

2. **或执行手动测试**（如果自动化仍失败）:
   - 使用 `TEST_SUMMARY.md` 中的手动测试清单
   - 记录每个步骤的结果
   - 截图记录任何错误

3. **验证关键流程**:
   - ✅ Fan 注册 → 充值 → 解锁 PPV → 查看购买记录
   - ✅ Creator 注册 → 成为 Creator → 发布 PPV → 查看收益
   - ✅ 刷新页面后内容仍可见（权限持久）

**预计时间**: 2-3 小时

---

## P2 - 一般错误（可延后修复）

### 🟢 [P2-001] 添加缺失的环境变量

**问题**: `NEXT_PUBLIC_APP_URL` 和 `NODE_ENV` 未设置

**影响**: 可能影响 OAuth 回调和环境识别

**修复步骤**:

1. 在 `.env.local` 中添加:

   ```bash
   NEXT_PUBLIC_APP_URL=https://mvp.getfansee.com
   NODE_ENV=production
   ```

2. 在服务器上的 `.env.production` 中也添加相同配置

3. 重启服务:
   ```bash
   pm2 restart mvp
   ```

**预计时间**: 15 分钟

---

### 🟢 [P2-002] 检查 Next.js 16 特定问题

**问题**: 可能存在 Next.js 16 相关的兼容性问题

**检查项**:

1. **API Route 参数类型**:

   ```bash
   # 搜索可能的问题
   grep -r "params\\.id" app/api/**/[id]/route.ts
   ```

   确保所有动态路由都使用:

   ```typescript
   export async function GET({ params }: { params: Promise<{ id: string }> }) {
     const { id } = await params;
     // ...
   }
   ```

2. **useSearchParams Suspense 边界**:

   ```bash
   # 搜索 useSearchParams 使用
   grep -r "useSearchParams" app/**/*.tsx
   ```

   确保都包裹在 `<Suspense>` 中

3. **Middleware 弃用警告**:
   - 检查是否有 middleware 弃用警告
   - 评估是否需要迁移到 `proxy.ts`（非阻塞）

**预计时间**: 1 小时

---

## 修复执行顺序

### 第一阶段：立即修复（P0）- 预计 2-4 小时

1. ✅ 修复 profiles 表 schema 问题 (30 分钟)
2. ✅ 修复购买记录与交易记录不匹配 (1-2 小时)
3. ✅ 解决 Playwright 浏览器安装问题 (30 分钟)

### 第二阶段：验证修复（P1）- 预计 2-3 小时

4. ✅ 重新运行数据完整性检查
5. ✅ 运行 E2E 测试或手动测试
6. ✅ 验证核心旅程闭环

### 第三阶段：优化改进（P2）- 预计 1-2 小时

7. ✅ 添加缺失的环境变量
8. ✅ 检查 Next.js 16 特定问题
9. ✅ 生成最终测试报告

---

## 验收标准

### 最低标准（MVP 可上线）

- [x] ENV Doctor 所有 P0 检查通过
- [ ] Money Flow 3 条护城河测试全部通过
- [ ] Sprint 4 MVP 测试通过
- [ ] 无 P0 错误
- [ ] Fan 和 Creator 核心旅程闭环（无阻塞）

### 理想标准（100 分）

- [ ] 所有 E2E 测试通过
- [ ] 无 P0 和 P1 错误
- [ ] 所有可点击元素有响应或明确禁用
- [ ] 前后端数据 100% 一致
- [ ] 无控制台错误
- [ ] 所有 Next.js 警告已修复

---

## 下一步行动

1. **立即开始 P0 修复**
   - 从最简单的开始：profiles schema
   - 然后处理购买记录问题
   - 最后解决 Playwright 问题

2. **修复后立即验证**
   - 运行 `pnpm tsx scripts/data-integrity-check.ts`
   - 运行 E2E 测试或手动测试
   - 记录所有结果

3. **生成最终报告**
   - 更新 `TEST_SUMMARY.md`
   - 更新 `ERROR_TRACKING.md`
   - 决定是否可以上线

---

**预计总时间**: 5-9 小时
**建议执行时间**: 立即开始，分 2-3 个工作时段完成
**优先级**: P0 必须在上线前完成
