# 数据库 Schema 修复指南

## ⚠️ 紧急修复

当前 `profiles` 表缺少必需字段，导致 `ensureProfile()` 无法正常工作。

**错误信息**：
- `column profiles.age_verified does not exist`
- `Could not find the 'email' column of 'profiles' in the schema cache`

---

## 修复步骤

### 方案 1：全新数据库（推荐）

如果这是新项目或可以清空数据：

1. 登录 Supabase Dashboard
2. 进入 **SQL Editor**
3. 复制 `migrations/001_init.sql` 的全部内容
4. 点击 **Run** 执行
5. ✅ 完成

### 方案 2：已有数据库修复（保留数据）

如果已有数据需要保留：

1. 登录 Supabase Dashboard
2. 进入 **SQL Editor**
3. 复制 `migrations/002_fix_profiles_schema.sql` 的全部内容
4. 点击 **Run** 执行
5. ✅ 完成

**注意**：修复脚本会自动：
- 检查字段是否存在
- 只添加缺失的字段
- 为已有记录填充默认值
- 验证修复结果

---

## 验证修复

执行修复 SQL 后，在 Supabase Dashboard → SQL Editor 中运行：

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'profiles'
ORDER BY ordinal_position;
```

**预期结果**：应该看到以下字段：

| column_name   | data_type   | is_nullable | column_default        |
|---------------|-------------|-------------|----------------------|
| id            | uuid        | NO          | (none)               |
| email         | text        | NO          | (none)               |
| display_name  | text        | YES         | (none)               |
| role          | text        | NO          | 'fan'::text          |
| age_verified  | boolean     | NO          | false                |
| avatar_url    | text        | YES         | (none)               |
| created_at    | timestamptz | NO          | timezone('utc'...)   |
| updated_at    | timestamptz | NO          | timezone('utc'...)   |

---

## 必需字段清单

`profiles` 表必须包含以下字段：

- ✅ `id` uuid PRIMARY KEY REFERENCES auth.users(id)
- ✅ `email` text NOT NULL
- ✅ `display_name` text
- ✅ `role` text NOT NULL DEFAULT 'fan'
- ✅ `age_verified` boolean NOT NULL DEFAULT false
- ✅ `created_at` timestamptz NOT NULL DEFAULT now()
- ✅ `updated_at` timestamptz NOT NULL DEFAULT now()

---

## 修复后测试

1. 刷新浏览器页面
2. 尝试注册或登录
3. 检查浏览器控制台（F12 → Console）
4. ✅ 应该不再看到 `column does not exist` 错误
5. ✅ `ensureProfile()` 应该能正常创建 profile

---

## 如果修复后仍有问题

1. 检查 Supabase Dashboard → Table Editor → `profiles` 表
2. 确认所有字段都存在
3. 检查 RLS 策略是否正确：
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'profiles';
   ```
4. 如果 RLS 策略缺失，重新执行 `migrations/001_init.sql` 中的策略创建语句

---

## 重要提醒

**在修复完成前，禁止继续任何 UI 或功能开发。**

所有认证相关功能都依赖于 `profiles` 表的正确结构。

