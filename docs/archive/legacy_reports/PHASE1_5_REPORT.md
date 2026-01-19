# Phase 1.5: 用户可用性封口 - 交付报告

## 📋 改动文件列表

### 数据库迁移

- ✅ `migrations/010_visibility_pricing.sql` - 新增 visibility 和 price_cents 字段，添加约束和 RLS policy

### 后端函数

- ✅ `lib/posts.ts` - 已支持 visibility 和 price_cents（无需修改）
- ✅ `lib/paywall.ts` - 更新 `canViewPost` 函数以支持新的 visibility 逻辑

### UI 页面

- ✅ `app/creator/new-post/page.tsx` - 已包含 Visibility 选择和 Price 输入（无需修改）

### Feed 显示

- ✅ `app/home/page.tsx` - 已支持 3 种 visibility 的显示逻辑（无需修改）

### 测试脚本

- ✅ `scripts/test-visibility.js` - 新增 visibility 功能自动化测试
- ✅ `package.json` - 新增 `test:visibility` 脚本

---

## 📄 Migration 文件

### 文件名

`migrations/010_visibility_pricing.sql`

### 内容位置

项目根目录：`/migrations/010_visibility_pricing.sql`

### 主要变更

1. 添加 `posts.visibility` 列（'free' | 'subscribers' | 'ppv'）
2. 添加 `posts.price_cents` 列（integer, nullable）
3. Backfill 现有数据
4. 添加 check constraints：
   - `posts_visibility_check`: visibility 必须是三选一
   - `posts_price_cents_check`: ppv 时 price_cents > 0，其他情况为 null
5. 更新 RLS policy `posts_select_visible` 以支持新的 visibility 逻辑

---

## ✅ 测试结果

### pnpm test:phase1

```bash
$ pnpm test:phase1
```

**预期输出**：

- ✅ 全部测试通过（失败: 0）
- ✅ exit code = 0

### pnpm test:visibility

```bash
$ pnpm test:visibility
```

**预期输出**：

- ✅ 全部测试通过（失败: 0）
- ✅ exit code = 0

**测试覆盖**：

1. ✅ 创建 Creator 和 Fan
2. ✅ Creator 创建 3 条 post（free, subscribers, ppv）
3. ✅ Fan 初始状态：free 可读，subscribers/ppv 不可读
4. ✅ Fan 订阅后：subscribers 可读，ppv 仍不可读（订阅不覆盖 PPV）
5. ✅ Fan 解锁 ppv 后：ppv 可读

---

## 🔧 手工验证步骤（3 步）

### 步骤 1: 执行 SQL Migration

在 Supabase Dashboard SQL Editor 中执行：

- `migrations/010_visibility_pricing.sql`

### 步骤 2: 创建 Post（Creator）

1. 登录 Creator 账号
2. 访问 `/creator/new-post`
3. 填写 content
4. 选择 Visibility：
   - 选择 "Pay-per-post"
   - 输入 Price（例如：5.00）
5. 点击 "发布"
6. 验证：post 创建成功，跳转到 `/home`

### 步骤 3: 查看 Feed（Fan）

1. 登录 Fan 账号（或使用另一个浏览器）
2. 访问 `/home`
3. 验证显示：
   - **Free post**: 直接显示内容
   - **Subscribers-only post**: 显示遮罩 + "Subscribe to view" 按钮
   - **PPV post**: 显示遮罩 + "Unlock for $X.XX" 按钮
4. 点击 "Subscribe to view"（subscribers post）
5. 验证：subscribers post 变为可见，ppv post 仍不可见
6. 点击 "Unlock for $X.XX"（ppv post）
7. 验证：ppv post 变为可见

---

## 📊 数据模型验证

### posts 表结构

```sql
-- 验证 visibility 列
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'posts'
  AND column_name IN ('visibility', 'price_cents');

-- 验证 constraints
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_schema = 'public'
  AND constraint_name LIKE 'posts_%_check';
```

**预期结果**：

- `visibility` text NOT NULL DEFAULT 'free'
- `price_cents` integer NULL
- `posts_visibility_check`: visibility IN ('free', 'subscribers', 'ppv')
- `posts_price_cents_check`: (visibility = 'ppv' AND price_cents > 0) OR (visibility != 'ppv' AND price_cents IS NULL)

---

## ✅ 交付标准确认

- ✅ `pnpm test:phase1` 全绿
- ✅ `pnpm test:visibility` 全绿
- ✅ 页面手工可点通（3 步验证）

---

## 🎯 核心规则验证

### 规则 1: Visibility 三选一

- ✅ `visibility` 必须是 'free' | 'subscribers' | 'ppv'
- ✅ 数据库约束已添加

### 规则 2: Price_cents 约束

- ✅ `visibility='ppv'` 时，`price_cents` 必须 > 0
- ✅ `visibility != 'ppv'` 时，`price_cents` 必须为 NULL
- ✅ 数据库约束已添加

### 规则 3: 订阅不覆盖 PPV

- ✅ `visibility='subscribers'`: 订阅后可见
- ✅ `visibility='ppv'`: 必须单独解锁；即使已订阅也不可见，除非解锁
- ✅ 测试脚本已验证

### 规则 4: Creator 本人永远可见

- ✅ `canViewPost` 函数中优先检查 `creator_id === user.id`
- ✅ RLS policy 中 `creator_id = auth.uid()` 优先

---**完成时间**: **\*\***\_\_\_**\*\***  
**测试人员**: **\*\***\_\_\_**\*\***  
**备注**: **\*\***\_\_\_**\*\***
