# 账务系统设置指南

## 📋 前置条件

### 1. 执行数据库迁移

在 Supabase Dashboard SQL Editor 中执行：

```sql
-- 执行 migrations/014_billing_system.sql
```

这个迁移文件会创建：
- `user_wallets` 表（用户钱包）
- `wallet_transactions` 表（交易流水）
- `rpc_purchase_post` 函数（原子扣费函数）
- `rpc_get_wallet_balance` 函数（获取余额）

### 2. 验证迁移成功

执行以下 SQL 验证：

```sql
-- 检查表是否存在
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'user_wallets'
    ) THEN '✅ user_wallets 表存在'
    ELSE '❌ user_wallets 表不存在'
  END AS wallets_status;

-- 检查函数是否存在
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_proc 
      WHERE proname = 'rpc_purchase_post'
    ) THEN '✅ rpc_purchase_post 函数存在'
    ELSE '❌ rpc_purchase_post 函数不存在'
  END AS purchase_function_status;
```

## 🧪 运行自动化审计

执行以下命令：

```bash
pnpm test:audit-billing
```

### 测试场景

1. **余额不足购买失败**
   - 创建用户，余额为 0
   - 创建 PPV post（价格 500 cents）
   - 尝试购买，应该失败并返回 "Insufficient balance"
   - 验证余额未变化

2. **余额充足购买成功**
   - 创建用户，余额 1000 cents
   - 创建 PPV post（价格 500 cents）
   - 购买成功
   - 验证余额扣费（1000 -> 500）
   - 验证购买记录已创建
   - 验证交易流水已创建

3. **未付钱尝试获取原始资源报错**
   - 创建 creator 和 fan 用户
   - Creator 创建 PPV post
   - Fan 尝试查询 post（应该被 RLS 阻止或返回锁定状态）
   - 验证购买记录不存在
   - 验证权限检查返回 false

## ✅ 预期结果

所有测试应该通过：

```
============================================================
📊 测试结果汇总
============================================================
总计: X 个测试
✅ 通过: X
❌ 失败: 0

============================================================
✅ PASSED - 所有测试通过
```

## 🔧 故障排除

### 错误：`Could not find the table 'public.user_wallets'`

**原因**：未执行数据库迁移

**解决**：执行 `migrations/014_billing_system.sql`

### 错误：`new row violates row-level security policy`

**原因**：RLS 策略阻止操作

**解决**：确保测试用户已正确创建 profile 并设置 role

### 错误：`Function rpc_purchase_post does not exist`

**原因**：函数未创建

**解决**：检查 migration 是否完整执行，特别是函数创建部分

## 📝 功能说明

### 原子扣费函数 `rpc_purchase_post`

**功能**：
- 在数据库内部检查余额是否充足
- 原子操作：扣费 + 记录交易 + 创建购买记录
- 防止余额变为负数（使用 CHECK 约束和 SELECT FOR UPDATE）

**参数**：
- `p_post_id`: Post ID
- `p_user_id`: User ID（可选，默认使用 `auth.uid()`）

**返回**：
```json
{
  "success": true,
  "transaction_id": "uuid",
  "purchase_id": "uuid",
  "balance_before_cents": 1000,
  "balance_after_cents": 500,
  "amount_cents": 500
}
```

或失败时：
```json
{
  "success": false,
  "error": "Insufficient balance",
  "balance_cents": 0,
  "required_cents": 500
}
```

### 权限检查

在 `lib/posts.ts` 的 `listFeed` 函数中：
- 未购买 PPV 内容时，**绝对禁止返回原始视频 URL**
- 对于视频：返回 `preview_url`（前端控制 10 秒限制）
- 对于图片：不返回 URL（显示锁定遮罩）
- 设置 `is_locked: true`

### 前端视频控制

在 `components/media-display.tsx` 中：
- 检测到 `is_locked` 时，视频播放至 10 秒后自动暂停
- 自动呼出 `PaywallModal` 支付弹窗
- 支付成功后刷新页面解锁完整内容

