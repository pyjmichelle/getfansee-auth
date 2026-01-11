# RLS 策略修复指南

## ⚠️ 问题：RLS 策略阻止插入

测试显示：`new row violates row-level security policy for table "profiles"`

这说明 `profiles_insert_own` 策略有问题，或者策略没有正确创建。

---

## 🔧 快速修复

### 步骤 1: 执行修复 SQL

1. 登录 Supabase Dashboard
2. 进入 **SQL Editor**
3. 复制 `migrations/003_fix_rls_policies.sql` 的全部内容
4. 点击 **Run** 执行
5. ✅ 应该看到：`✅ RLS 策略修复完成！已创建 X 个策略。`

### 步骤 2: 验证策略

执行修复 SQL 后，会显示所有策略的列表。应该看到：

- `profiles_select_own` (SELECT)
- `profiles_insert_own` (INSERT)
- `profiles_update_own` (UPDATE)
- `profiles_delete_own` (DELETE) - 可选

### 步骤 3: 重新运行测试

```bash
pnpm test:auth
```

现在 `ensureProfile (创建)` 和 `RLS INSERT 策略` 应该通过。

---

## 🔍 手动检查策略

如果修复后仍有问题，在 Supabase Dashboard → SQL Editor 中运行：

```sql
-- 检查所有策略
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'profiles'
ORDER BY policyname;

-- 检查 RLS 是否启用
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'profiles';
```

**预期结果**：
- `rowsecurity` 应该是 `true`
- 至少有 3 个策略（SELECT, INSERT, UPDATE）

---

## 🐛 常见问题

### 问题 1: 策略已存在但仍有错误

**原因**：策略的条件不正确

**解决**：
1. 执行 `migrations/003_fix_rls_policies.sql`（会先删除再重新创建）
2. 确保 `WITH CHECK (auth.uid() = id)` 条件正确

### 问题 2: auth.uid() 返回 null

**原因**：用户没有有效的 session

**解决**：
1. 确保在插入前用户已登录（有 session）
2. 检查 Supabase Auth 配置是否正确

### 问题 3: 策略创建失败

**原因**：权限不足或语法错误

**解决**：
1. 确认使用 `postgres` 角色执行 SQL
2. 检查 SQL 语法是否正确
3. 查看 Supabase Dashboard 的错误信息

---

## ✅ 修复后验证

修复完成后，运行测试：

```bash
pnpm test:auth
```

**预期结果**：
- ✅ `ensureProfile (创建)` - 通过
- ✅ `RLS INSERT 策略` - 通过
- ✅ 所有测试通过

---

## 📝 策略说明

### profiles_insert_own 策略

```sql
CREATE POLICY "profiles_insert_own"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);
```

**含义**：
- 用户只能插入自己的 profile
- `auth.uid()` 必须等于插入的 `id`
- 这确保了用户不能为其他用户创建 profile

**为什么测试失败**：
- 如果 `auth.uid()` 返回 `null`（没有 session）
- 或者策略没有正确创建
- 或者策略被其他策略覆盖

---

## 🚀 下一步

RLS 策略修复后，可以继续：
1. 运行完整测试：`pnpm test:auth`
2. 测试实际功能（注册、登录、创建 profile）
3. 继续开发其他功能



