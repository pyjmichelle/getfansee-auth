# 地理屏蔽 RLS 策略修复指南

## ⚠️ 重要：需要执行额外的 RLS 策略迁移

地理屏蔽功能需要允许查询 creator 的 `blocked_countries` 字段，但当前的 RLS 策略只允许用户查询自己的 profile。

## 📋 执行步骤

### 1. 执行 RLS 策略修复迁移

在 Supabase Dashboard SQL Editor 中执行：

```sql
-- 执行 migrations/016_geo_blocking_rls_fix.sql
```

这个迁移会创建 `profiles_select_creators` 策略，允许：

- 查询自己的 profile（已有策略覆盖）
- 查询 creator 的 profile（用于地理屏蔽和显示）

### 2. 验证策略已创建

执行以下查询：

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

**预期结果**：应该看到 `profiles_select_creators` 策略。

### 3. 测试查询 creator 的 profile

```sql
-- 测试查询 creator 的 profile（需要替换为真实的 creator ID）
SELECT id, role, blocked_countries
FROM public.profiles
WHERE role = 'creator'
LIMIT 1;
```

如果策略正确，应该能够查询到 creator 的 profile。

## 🔧 如果策略仍然不工作

如果执行迁移后仍然无法查询 creator 的 profile，可以尝试：

1. **刷新 schema cache**：

   ```sql
   NOTIFY pgrst, 'reload schema';
   ```

2. **检查策略是否正确应用**：

   ```sql
   SELECT * FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename = 'profiles'
     AND policyname = 'profiles_select_creators';
   ```

3. **手动创建策略**（如果迁移失败）：
   ```sql
   CREATE POLICY "profiles_select_creators"
     ON public.profiles
     FOR SELECT
     USING (
       auth.uid() = id
       OR
       (
         role = 'creator'
         AND EXISTS (
           SELECT 1 FROM public.creators
           WHERE creators.id = profiles.id
         )
       )
     );
   ```

## ✅ 验证

执行以下命令验证：

```bash
pnpm test:privacy
```

所有测试应该通过。
