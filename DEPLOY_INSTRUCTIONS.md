# 部署前必做清单

## ⚠️ 重要：执行 SQL 迁移

在运行 `pnpm test:auth` 之前，**必须先执行以下 SQL**：

### 步骤 1: 执行 profiles 表结构修复

1. 登录 Supabase Dashboard
2. 进入 **SQL Editor**
3. 复制 `migrations/004_fix_profiles_final.sql` 的全部内容
4. 点击 **Run** 执行
5. ✅ 应该看到：
   - 所有字段的列表
   - RLS 策略列表
   - 没有错误信息

### 步骤 2: 验证 .env.local

确保 `.env.local` 包含以下变量：

```bash
NEXT_PUBLIC_SUPABASE_URL=https://ordomkygjpujxyivwviq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的_anon_key
SUPABASE_SERVICE_ROLE_KEY=你的_service_role_key
```

### 步骤 3: 运行测试

```bash
pnpm test:auth
```

**预期结果**：所有测试全绿 ✅

---

## 🔍 如果测试失败

### 错误：表结构检查失败

**原因**：未执行 `migrations/004_fix_profiles_final.sql`

**解决**：
1. 执行 `migrations/004_fix_profiles_final.sql`
2. 等待几秒让 schema cache 刷新
3. 重新运行 `pnpm test:auth`

### 错误：缺少 SERVICE_ROLE_KEY

**原因**：`.env.local` 中没有 `SUPABASE_SERVICE_ROLE_KEY`

**解决**：
```bash
echo "SUPABASE_SERVICE_ROLE_KEY=你的_service_role_key" >> .env.local
```

### 错误：Schema 验收失败

**原因**：表结构不完整或 RLS 策略有问题

**解决**：
1. 重新执行 `migrations/004_fix_profiles_final.sql`
2. 检查 Supabase Dashboard → Table Editor → profiles 表，确认所有字段存在
3. 检查 Supabase Dashboard → Authentication → Policies，确认 RLS 策略存在

---

## ✅ 测试通过标准

运行 `pnpm test:auth` 后，必须看到：

```
📊 测试结果汇总
总测试数: X
✅ 通过: X
失败: 0

🎉 所有测试通过！
```

**只有所有测试全绿才算交付完成。**



