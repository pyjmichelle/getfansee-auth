# 地理屏蔽功能设置指南

## 问题诊断

如果测试失败并出现以下错误：

```
profileError: 'Cannot coerce the result to a single JSON object'
profileErrorCode: 'PGRST116'
```

这表示 RLS（Row Level Security）策略阻止了匿名用户查询 creator 的 profile。

## 解决方案

### 步骤 1: 执行数据库迁移

1. 打开 Supabase Dashboard
2. 进入 SQL Editor
3. 执行以下迁移文件（按顺序）：

#### 迁移 1: 添加字段

```sql
-- 执行 migrations/015_geo_blocking_kyc.sql
-- 这会添加 blocked_countries 和 age_verified 字段
```

#### 迁移 2: 修复 RLS 策略

```sql
-- 执行 migrations/016_geo_blocking_rls_fix.sql
-- 这会允许匿名用户查询 creator 的 profile（用于地理屏蔽）
```

### 步骤 2: 验证迁移

执行以下 SQL 查询，确认策略已创建：

```sql
SELECT
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'profiles'
ORDER BY policyname;
```

你应该看到 `profiles_select_creators` 策略，并且 `cmd` 应该是 `SELECT`。

### 步骤 3: 运行测试

```bash
pnpm test:privacy
```

## 技术说明

### RLS 策略工作原理

`profiles_select_creators` 策略允许：

- 认证用户查询自己的 profile
- 匿名用户和认证用户查询 creator 的 profile（用于地理屏蔽检查）

策略定义：

```sql
CREATE POLICY "profiles_select_creators"
  ON public.profiles
  FOR SELECT
  TO authenticated, anon  -- 允许认证用户和匿名用户
  USING (
    auth.uid() = id  -- 自己的 profile
    OR
    role = 'creator'  -- creator 的 profile（用于地理屏蔽）
  );
```

**注意**：策略已简化为直接检查 `role = 'creator'`，无需检查 `creators` 表，这样更可靠且性能更好。

### 为什么需要这个策略？

`lib/posts.ts` 中的 `listCreatorPosts` 函数使用全局 `supabase` 客户端（没有用户会话），需要查询 creator 的 `blocked_countries` 字段来执行地理屏蔽。如果没有这个策略，RLS 会阻止匿名用户查询其他用户的 profile。

## 故障排除

### 问题 1: 迁移执行后仍然失败

检查：

1. 策略是否真的创建了（使用上面的验证 SQL）
2. `creators` 表中是否有对应的记录
3. `profiles.role` 是否设置为 `'creator'`

### 问题 2: 策略创建失败

确保：

1. 你有足够的权限执行 DDL 语句
2. 没有其他策略冲突
3. `profiles` 表已启用 RLS

### 问题 3: 测试脚本可以查询，但 `listCreatorPosts` 失败

这是因为：

- 测试脚本使用有用户会话的 `supabase` 客户端
- `listCreatorPosts` 使用全局 `supabase` 客户端（匿名用户）

解决方案：执行 `016_geo_blocking_rls_fix.sql` 迁移，允许匿名用户查询 creator 的 profile。
