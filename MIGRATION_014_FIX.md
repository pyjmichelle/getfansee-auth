# Migration 014 执行指南

## ⚠️ 重要提示

如果执行迁移时遇到错误 `function public.rpc_purchase_post(uuid) does not exist`，请按以下步骤操作：

## 📋 执行步骤

### 1. 完整执行迁移文件

在 Supabase Dashboard SQL Editor 中：

1. 打开 `migrations/014_billing_system.sql`
2. **完整复制所有内容**（包括所有注释和验证查询）
3. 粘贴到 SQL Editor
4. 点击 **Run**

### 2. 验证函数是否创建成功

执行以下查询（不调用函数，只检查是否存在）：

```sql
-- 检查函数是否存在
SELECT
  p.proname AS function_name,
  pg_get_function_arguments(p.oid) AS arguments,
  pg_get_function_result(p.oid) AS return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'rpc_purchase_post';
```

**预期结果**：应该看到一行，显示函数名、参数列表和返回类型。

### 3. 测试函数调用

**重要**：函数需要两个参数，第二个参数有默认值。

**方式 1：提供两个参数**

```sql
SELECT public.rpc_purchase_post(
  'post-id-here'::uuid,
  'user-id-here'::uuid
);
```

**方式 2：只提供一个参数（使用默认值 `auth.uid()`）**

```sql
-- 注意：这需要在有认证上下文中调用
SELECT public.rpc_purchase_post('post-id-here'::uuid);
```

### 4. 如果验证查询报错

如果迁移文件末尾的验证查询报错 `function public.rpc_purchase_post(uuid) does not exist`，这通常是因为：

1. **函数未成功创建**：检查迁移执行时是否有错误
2. **验证查询本身有问题**：验证查询不应该调用函数，只应该检查是否存在

**解决方案**：

1. 重新执行迁移文件（确保没有错误）
2. 使用上面的验证查询（步骤 2）手动检查函数是否存在
3. 如果函数存在但验证查询报错，可以忽略验证查询的错误（函数已经创建成功）

## ✅ 成功标志

迁移成功执行后，你应该看到：

1. ✅ `user_wallets` 表存在
2. ✅ `wallet_transactions` 表存在
3. ✅ `rpc_purchase_post` 函数存在（通过步骤 2 的查询确认）
4. ✅ `rpc_get_wallet_balance` 函数存在

## 🔧 故障排除

### 错误：`relation "public.user_wallets" does not exist`

**原因**：表未创建

**解决**：重新执行迁移文件，确保表创建部分成功执行

### 错误：`function public.rpc_purchase_post(uuid) does not exist`

**可能原因**：

1. 函数未创建
2. 验证查询尝试调用函数（不应该）

**解决**：

1. 使用步骤 2 的查询检查函数是否存在
2. 如果函数存在，可以忽略验证查询的错误
3. 如果函数不存在，重新执行迁移文件

### 错误：`permission denied for function rpc_purchase_post`

**原因**：GRANT 语句未执行

**解决**：确保迁移文件中的 GRANT 语句已执行

## 📝 函数签名说明

`rpc_purchase_post` 函数定义：

```sql
CREATE OR REPLACE FUNCTION public.rpc_purchase_post(
  p_post_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS jsonb
```

**参数**：

- `p_post_id` (必需): Post ID
- `p_user_id` (可选): User ID，默认为 `auth.uid()`

**调用方式**：

- 两个参数：`rpc_purchase_post(post_id, user_id)`
- 一个参数：`rpc_purchase_post(post_id)` - 使用默认的 `auth.uid()`

**注意**：在 Supabase 客户端（JavaScript/TypeScript）中调用时，如果只提供一个参数，Supabase 会自动处理默认参数。
