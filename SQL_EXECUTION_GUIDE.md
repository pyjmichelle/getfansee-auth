# SQL 执行指南 - 005_paywall.sql

## ⚠️ 如果遇到语法错误

如果执行 `migrations/005_paywall.sql` 时遇到语法错误，请使用 `migrations/005_paywall_clean.sql`（已移除中文注释，使用英文）。

---

## 执行步骤

### 方法 1: 使用原始文件（推荐）

1. 打开 `migrations/005_paywall.sql`
2. **只复制从第 9 行开始的内容**（跳过文件开头的注释）
3. 或者复制从 `CREATE TABLE IF NOT EXISTS` 开始的所有内容
4. 粘贴到 Supabase SQL Editor
5. 点击 Run

### 方法 2: 使用清理版本（如果方法 1 失败）

1. 打开 `migrations/005_paywall_clean.sql`
2. 复制全部内容
3. 粘贴到 Supabase SQL Editor
4. 点击 Run

---

## 验证执行成功

执行后应该看到：

1. **NOTICE 消息**：`Tables created successfully`
2. **策略列表**：显示 subscriptions 和 post_unlocks 的所有 RLS 策略（共 8 个策略）

如果看到错误，请检查：
- 是否复制了完整的 SQL（从 CREATE TABLE 开始）
- 是否跳过了文件开头的注释行
- 是否有其他 SQL 语句在编辑器中残留

---

## 常见错误

### 错误：syntax error at or near "-"

**原因**：可能复制了文件开头的注释行，或包含了非 SQL 内容

**解决**：
1. 只复制从 `CREATE TABLE IF NOT EXISTS` 开始的内容
2. 或使用 `005_paywall_clean.sql`

### 错误：relation already exists

**原因**：表已存在

**解决**：这是正常的，`IF NOT EXISTS` 会跳过已存在的表。可以继续执行。

### 错误：policy already exists

**原因**：策略已存在

**解决**：这是正常的，`DROP POLICY IF EXISTS` 会先删除再创建。可以继续执行。



