# Migration 014 执行指南（详细版）

## ⚠️ 重要：如何正确执行迁移

### 步骤 1：打开 Supabase Dashboard

1. 登录 https://supabase.com/dashboard
2. 选择你的项目
3. 点击左侧菜单的 **SQL Editor**

### 步骤 2：复制 SQL 内容

**重要**：只复制 SQL 代码，不要复制文件名或其他内容。

1. 打开 `migrations/014_billing_system.sql` 文件
2. **全选所有内容**（从第一行 `-- 014_billing_system.sql` 到最后一行）
3. **复制**（Ctrl+C / Cmd+C）

### 步骤 3：粘贴到 SQL Editor

1. 在 Supabase SQL Editor 中，**清空**现有内容（如果有）
2. **粘贴**（Ctrl+V / Cmd+V）
3. 确保第一行是：`-- 014_billing_system.sql`（两个短横线 `--`）

### 步骤 4：执行

1. 点击 **Run** 按钮（或按 Ctrl+Enter）
2. 等待执行完成

### 步骤 5：检查结果

执行成功后，你应该看到：

1. **表创建成功**：
   - ✅ `user_wallets 表存在`
   - ✅ `wallet_transactions 表存在`

2. **函数创建成功**：
   - ✅ `rpc_purchase_post 函数存在`
   - ✅ `rpc_get_wallet_balance 函数存在`

3. **函数签名信息**：
   - 显示两个函数的参数和返回类型

## 🔧 常见错误及解决

### 错误 1：`syntax error at or near "--"`

**原因**：可能复制了不完整的内容，或者包含了非 SQL 字符

**解决**：

1. 重新打开 `migrations/014_billing_system.sql`
2. 全选所有内容（确保从第一行开始）
3. 重新复制并粘贴

### 错误 2：`relation "public.user_wallets" already exists`

**原因**：表已经存在

**解决**：

- 如果表已存在但需要更新，可以继续执行（`CREATE TABLE IF NOT EXISTS` 不会报错）
- 或者先删除表再执行：
  ```sql
  DROP TABLE IF EXISTS public.wallet_transactions CASCADE;
  DROP TABLE IF EXISTS public.user_wallets CASCADE;
  ```

### 错误 3：`function "rpc_purchase_post" already exists`

**原因**：函数已经存在

**解决**：

- 继续执行即可（`CREATE OR REPLACE FUNCTION` 会替换现有函数）

### 错误 4：`permission denied`

**原因**：权限不足

**解决**：

- 确保使用 Supabase Dashboard 的 SQL Editor（有完整权限）
- 不要使用客户端连接执行

## ✅ 验证迁移成功

执行以下查询验证：

```sql
-- 检查表
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'user_wallets'
    ) THEN '✅ user_wallets 表存在'
    ELSE '❌ user_wallets 表不存在'
  END AS wallets_status;

-- 检查函数
SELECT
  p.proname AS function_name,
  pg_get_function_arguments(p.oid) AS arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN ('rpc_purchase_post', 'rpc_get_wallet_balance')
ORDER BY p.proname;
```

## 📝 快速执行（仅验证查询）

如果只想验证函数是否存在（不执行完整迁移），可以只执行验证部分：

```sql
-- 只验证，不创建
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
        AND p.proname = 'rpc_purchase_post'
    ) THEN '✅ rpc_purchase_post 函数存在'
    ELSE '❌ rpc_purchase_post 函数不存在'
  END AS purchase_function_status;

SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
        AND p.proname = 'rpc_get_wallet_balance'
    ) THEN '✅ rpc_get_wallet_balance 函数存在'
    ELSE '❌ rpc_get_wallet_balance 函数不存在'
  END AS balance_function_status;
```

## 🎯 执行后下一步

迁移成功后：

1. **运行自动化审计**：

   ```bash
   pnpm test:audit-billing
   ```

2. **测试函数调用**（在 SQL Editor 中）：
   ```sql
   -- 测试获取余额（需要先登录）
   SELECT public.rpc_get_wallet_balance();
   ```
