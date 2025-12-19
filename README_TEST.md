# 自动化测试指南

## 🚀 快速开始

运行认证流程自动化测试：

```bash
pnpm test:auth
```

或直接运行：

```bash
node test-auth-flow.js
```

---

## 📋 测试内容

测试脚本会自动测试以下功能：

### 1. ✅ 检查 profiles 表结构
- 验证所有必需字段是否存在
- 检查字段类型和约束

### 2. ✅ 测试注册功能
- 测试 `signUpWithEmail()` API
- 验证返回的 `user` 和 `session` 状态
- 检查 `hasSession` 值（取决于 Supabase 邮箱验证设置）

### 3. ✅ 测试 ensureProfile 功能
- 测试 profile 查询
- 测试 profile 创建（如果不存在）
- 验证 RLS 策略是否允许操作

### 4. ✅ 测试登录功能
- 测试 `signInWithEmail()` API
- 验证登录后是否有 session

### 5. ✅ 测试 RLS 策略
- 测试 SELECT 策略（查询自己的 profile）
- 测试 INSERT 策略（创建自己的 profile）

### 6. ✅ 清理测试数据
- 删除测试创建的 profile
- 退出登录

---

## 📊 测试输出示例

```
🚀 开始认证流程自动化测试

ℹ️  Supabase URL: https://ordomkygjpujxyivwviq...

📋 测试 1: 检查 profiles 表结构
✅ profiles 表结构 - 通过
   详情: 所有必需字段都存在

📝 测试 2: 测试注册功能
✅ 注册功能 - 通过
   详情: hasUser: true, hasSession: true, userId: 2e7148db-...

👤 测试 3: 测试 ensureProfile 功能
✅ ensureProfile (查询) - 通过
   详情: Profile 已存在: email=test-1234567890@example.com, role=fan

🔐 测试 4: 测试登录功能
✅ 登录功能 - 通过
   详情: userId: 2e7148db-...

🔒 测试 5: 测试 RLS 策略
✅ RLS SELECT 策略 - 通过
   详情: 可以查询自己的 profile
✅ RLS INSERT 策略 - 通过
   详情: 可以插入自己的 profile（已存在）

🧹 测试 6: 清理测试数据
✅ 清理测试数据 - 通过
   详情: 测试数据已清理（auth.users 需要手动删除）

==================================================
📊 测试结果汇总
==================================================
总测试数: 7
✅ 通过: 7
==================================================

🎉 所有测试通过！
```

---

## ⚙️ 前置条件

1. ✅ 已配置 `.env.local` 文件
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

2. ✅ 已执行数据库迁移
   - `migrations/001_init.sql`（新数据库）
   - 或 `migrations/002_fix_profiles_schema.sql`（已有数据库）

3. ✅ 已安装依赖
   - `@supabase/supabase-js` 已在 `package.json` 中

---

## 🔧 故障排查

### 问题 1: 无法读取 .env.local

**错误**：`无法读取 .env.local 文件`

**解决**：
1. 确认 `.env.local` 文件在项目根目录
2. 确认文件内容格式正确（每行一个 `KEY=VALUE`）

### 问题 2: 表结构检查失败

**错误**：`缺少字段: column profiles.email does not exist`

**解决**：
1. 执行 `migrations/002_fix_profiles_schema.sql`
2. 或执行 `migrations/001_init.sql`（如果是新数据库）

### 问题 3: 注册后没有 session

**警告**：`跳过 ensureProfile 测试（注册后没有 session）`

**说明**：
- 这是正常的，如果 Supabase 启用了邮箱验证
- 测试会继续测试登录功能，登录后应该有 session

### 问题 4: RLS 策略阻止操作

**错误**：`RLS 策略阻止插入`

**解决**：
1. 检查 Supabase Dashboard → Authentication → Policies
2. 确认 `profiles_insert_own` 策略存在且正确
3. 重新执行 `migrations/001_init.sql` 中的策略创建语句

---

## 📝 测试脚本说明

### 文件位置
- `test-auth-flow.js` - 主测试脚本

### 测试数据
- 测试会创建临时用户：`test-{timestamp}@example.com`
- 测试完成后会清理 profile 数据
- **注意**：`auth.users` 表中的测试用户需要手动删除（Supabase 限制）

### 手动清理测试用户

如果测试创建了用户，可以在 Supabase Dashboard 中手动删除：

1. 进入 **Authentication** → **Users**
2. 搜索测试邮箱（`test-*@example.com`）
3. 删除测试用户

---

## 🔄 持续集成

可以将此测试脚本集成到 CI/CD 流程中：

```yaml
# .github/workflows/test.yml
name: Test Auth Flow
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: pnpm install
      - run: pnpm test:auth
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
```

---

## 💡 使用建议

1. **每次修改认证相关代码后运行测试**
2. **在提交代码前运行测试**
3. **在部署前运行测试**
4. **定期运行测试确保功能正常**

---

## 🎯 下一步

测试通过后，可以继续开发其他功能：
- Paywall 功能（Step 3）
- View as Fan 功能（Step 4）
- 静态导出验证（Step 5）

