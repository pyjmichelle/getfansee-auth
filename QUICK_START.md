# 🚀 快速开始 - 测试前必做

## 步骤 1: 执行 SQL 迁移（必须）

**在 Supabase Dashboard 执行 `migrations/004_fix_profiles_final.sql`**

这个 SQL 会：

- ✅ 补齐 profiles 表所有字段（email, display_name, role, age_verified, created_at, updated_at）
- ✅ 创建/修复 RLS 策略
- ✅ 刷新 schema cache

**执行方法**：

1. 登录 https://supabase.com/dashboard
2. 选择你的项目
3. 进入 **SQL Editor**
4. 复制 `migrations/004_fix_profiles_final.sql` 的全部内容
5. 粘贴到 SQL Editor
6. 点击 **Run**
7. ✅ 应该看到字段列表和策略列表，没有错误

---

## 步骤 2: 确认 .env.local 配置

确保 `.env.local` 包含：

```bash
NEXT_PUBLIC_SUPABASE_URL=https://ordomkygjpujxyivwviq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的_anon_key
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yZG9ta3lnanB1anh5aXZ3dmlxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDQ4ODQ2NywiZXhwIjoyMDgwMDY0NDY3fQ.aDk8dVJfxCxxoGjejRje7-O-keDq59Bvw9oL7IsPIH4
```

**如果 SERVICE_ROLE_KEY 不存在，手动添加**：

```bash
echo "SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yZG9ta3lnanB1anh5aXZ3dmlxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDQ4ODQ2NywiZXhwIjoyMDgwMDY0NDY3fQ.aDk8dVJfxCxxoGjejRje7-O-keDq59Bvw9oL7IsPIH4" >> .env.local
```

---

## 步骤 3: 运行测试

```bash
pnpm test:auth
```

**预期输出**：

```
🚀 开始认证流程自动化测试

📋 测试 1: 检查 profiles 表结构（使用 SERVICE_ROLE_KEY）
✅ profiles 表结构 - 通过

🔍 测试 2: Schema 验收 - 插入和查询 profiles（使用 SERVICE_ROLE_KEY）
✅ Schema 验收 - 插入 - 通过
✅ Schema 验收 - 查询 - 通过

📝 测试 3: 测试注册功能（使用 ANON_KEY）
✅ 注册功能 - 通过

👤 测试 4: ensureProfile 逻辑验收（使用 SERVICE_ROLE_KEY）
✅ ensureProfile 逻辑验收 - 查询 - 通过
✅ ensureProfile 逻辑验收 - 字段验证 - 通过

🔐 测试 5: 测试登录功能（使用 ANON_KEY）
✅ 登录功能 - 通过

✅ 测试 6: 登录后 profile 验证（使用 SERVICE_ROLE_KEY）
✅ 登录后 profile 验证 - 通过

🧹 测试 7: 清理测试数据（使用 SERVICE_ROLE_KEY）
✅ 清理测试数据 - 通过

📊 测试结果汇总
总测试数: X
✅ 通过: X
失败: 0

🎉 所有测试通过！
```

---

## ❌ 如果测试失败

### 错误：表结构检查失败

**解决**：执行 `migrations/004_fix_profiles_final.sql`

### 错误：缺少 SERVICE_ROLE_KEY

**解决**：检查 `.env.local` 是否包含 `SUPABASE_SERVICE_ROLE_KEY`

### 错误：Schema 验收失败

**解决**：

1. 重新执行 `migrations/004_fix_profiles_final.sql`
2. 等待 5-10 秒让 schema cache 刷新
3. 重新运行测试

---

## ✅ 交付标准

**只有所有测试全绿（失败: 0）才算交付完成。**
