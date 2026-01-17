# 修复 Creators 表 RLS 策略

## 问题

测试 `test:visibility` 失败，因为 RLS 策略阻止插入 `creators` 表。

## 解决方案

### 1. 在 Supabase Dashboard 中执行以下 SQL

登录 Supabase Dashboard → SQL Editor，执行以下 SQL：

```sql
-- creators: allow user to create/update their own creator profile
ALTER TABLE public.creators ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS creators_insert_self ON public.creators;
CREATE POLICY creators_insert_self
ON public.creators
FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS creators_select_all ON public.creators;
CREATE POLICY creators_select_all
ON public.creators
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS creators_update_self ON public.creators;
CREATE POLICY creators_update_self
ON public.creators
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());
```

### 2. 或者执行完整的 migration

在 Supabase Dashboard → SQL Editor 中，执行 `migrations/013_money_access_mvp.sql` 的全部内容（这会更新 RLS 策略）。

### 3. 验证策略

执行以下 SQL 验证策略是否正确创建：

```sql
SELECT
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'creators'
ORDER BY policyname;
```

应该看到 3 个策略：

- `creators_select_all` (SELECT)
- `creators_insert_self` (INSERT)
- `creators_update_self` (UPDATE)

### 4. 重新运行测试

```bash
pnpm test:visibility
```

## 测试脚本更改

测试脚本已更新为：

1. 先创建 profile（role='fan'）避免 trigger 问题
2. 显式插入 `creators` 记录（不依赖 trigger）
3. 然后更新 profile role 为 'creator'
4. 打印完整的错误对象（code/message/details/hint）

## 注意事项

- 确保在 Supabase 中执行了 migration 或上述 SQL
- 测试脚本现在不依赖 trigger，直接插入 `creators` 记录
- 如果仍然失败，检查 Supabase 中的 RLS 策略是否正确应用
