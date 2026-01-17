# Paywall 状态检查指南

## ✅ 好消息

从测试结果看，**所有 12 个测试都通过了**，说明数据库结构是完整的！

---

## 🔍 如果担心删除了某些 SQL

### 快速验证

执行 `migrations/005_verify_paywall.sql` 来检查：

1. 打开 Supabase Dashboard → SQL Editor
2. 复制 `migrations/005_verify_paywall.sql` 的全部内容
3. 粘贴并点击 Run
4. 查看结果：
   - ✅ 如果看到 "表存在"、"RLS 已启用"、策略列表完整 → **一切正常**
   - ❌ 如果看到 "表不存在" 或缺少策略 → 需要重新执行创建 SQL

---

## 📋 必需的表和策略

### subscriptions 表必需字段

- `id` (uuid, primary key)
- `user_id` (uuid, references auth.users)
- `status` (text, default 'active')
- `current_period_end` (timestamptz)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)
- `UNIQUE(user_id)` 约束

### post_unlocks 表必需字段

- `id` (uuid, primary key)
- `user_id` (uuid, references auth.users)
- `post_id` (text)
- `created_at` (timestamptz)
- `UNIQUE(user_id, post_id)` 约束

### 必需的 RLS 策略

**subscriptions (4 个策略)**：

- `subscriptions_select_own` (SELECT)
- `subscriptions_insert_own` (INSERT)
- `subscriptions_update_own` (UPDATE)
- `subscriptions_delete_own` (DELETE)

**post_unlocks (3 个策略)**：

- `post_unlocks_select_own` (SELECT)
- `post_unlocks_insert_own` (INSERT)
- `post_unlocks_delete_own` (DELETE)

### 必需的触发器

- `set_subscriptions_updated_at` (在 subscriptions 表上)

---

## 🔧 如果发现缺失

如果验证脚本显示有缺失，重新执行：

1. **如果表不存在**：执行 `migrations/005_paywall_clean.sql`（只执行表创建部分）
2. **如果策略缺失**：执行 `migrations/005_paywall_clean.sql`（只执行策略创建部分）
3. **如果触发器缺失**：执行 `migrations/005_paywall_clean.sql`（只执行触发器创建部分）

---

## ✅ 当前状态

从测试结果看：

- ✅ 所有测试通过（12/12）
- ✅ subscribe30d 功能正常
- ✅ unlockPost 功能正常
- ✅ paywall state 查询正常

**结论**：数据库结构应该是完整的，即使你删除了 SQL 文件中的某些内容，只要数据库中的表和策略还在，功能就能正常工作。

---

## 💡 建议

1. **保留 SQL 文件**：即使删除了，建议保留 `005_paywall_clean.sql` 作为备份
2. **执行验证脚本**：运行 `005_verify_paywall.sql` 确认一切正常
3. **如果一切正常**：可以继续开发，不需要担心
