# Supabase 邮箱配置检查清单

## 问题：注册后没有收到验证邮件

如果注册后显示 "Check your email for a confirmation link..." 但没有收到邮件，请按以下步骤检查：

---

## 1. 检查 Supabase Dashboard 配置

### 1.1 检查邮箱验证是否启用

1. 登录 Supabase Dashboard
2. 进入 **Authentication** → **Settings**
3. 找到 **"Enable email confirmations"** 选项
4. **如果已启用**：用户必须点击邮件中的链接才能登录
5. **如果已禁用**：注册后立即可以登录（不需要验证）

### 1.2 检查 SMTP 配置

1. 进入 **Settings** → **Auth** → **SMTP Settings**
2. 检查是否配置了自定义 SMTP
   - **如果未配置**：Supabase 使用默认邮件服务（可能有延迟或限制）
   - **如果已配置**：检查 SMTP 配置是否正确

### 1.3 检查邮件模板

1. 进入 **Authentication** → **Email Templates**
2. 检查 **"Confirm signup"** 模板
3. 确认模板中的 `{{ .ConfirmationURL }}` 正确

---

## 2. 检查 Supabase 项目设置

### 2.1 检查 Site URL

1. 进入 **Settings** → **API**
2. 检查 **Site URL** 是否设置为：`http://localhost:3000`（开发环境）
3. 检查 **Redirect URLs** 是否包含：`http://localhost:3000/auth/verify`

### 2.2 检查 Rate Limiting

1. 进入 **Settings** → **Auth**
2. 检查是否有发送邮件的频率限制
3. 如果短时间内多次注册，可能会被限制

---

## 3. 检查邮箱

### 3.1 检查垃圾邮件文件夹

- 验证邮件可能被标记为垃圾邮件
- 检查所有邮件文件夹（包括 Spam/Junk）

### 3.2 检查邮箱是否正确

- 确认输入的邮箱地址正确
- 尝试使用不同的邮箱地址测试

---

## 4. 临时解决方案：禁用邮箱验证（仅用于开发测试）

如果只是用于开发测试，可以临时禁用邮箱验证：

1. 进入 **Authentication** → **Settings**
2. 关闭 **"Enable email confirmations"**
3. 保存设置
4. 重新测试注册

**注意**：禁用后，注册会立即创建 session，代码会自动创建 profile 并跳转到 `/home`。

---

## 5. 检查代码日志

打开浏览器控制台（F12 → Console），查看是否有以下日志：

```
[auth] signUpWithEmail called
[auth] signUp response: { hasUser: true, hasSession: false, error: undefined }
```

- `hasUser: true` 说明注册成功
- `hasSession: false` 说明需要邮箱验证
- 如果有 `error`，说明注册失败

---

## 6. 验证 Supabase 数据库

1. 进入 Supabase Dashboard → **Table Editor** → **auth.users**
2. 查看是否有新注册的用户
3. 检查 `email_confirmed_at` 字段：
   - `null` = 邮箱未验证
   - 有日期 = 邮箱已验证

---

## 7. 使用 Supabase 的测试邮箱（开发环境）

Supabase 提供测试邮箱功能：

1. 进入 **Authentication** → **Settings**
2. 找到 **"Test Email"** 或 **"Email Testing"**
3. 可以查看发送的测试邮件（仅限开发环境）

---

## 8. 配置自定义 SMTP（生产环境推荐）

如果需要可靠的邮件服务，建议配置自定义 SMTP：

1. 进入 **Settings** → **Auth** → **SMTP Settings**
2. 配置 SMTP 服务器（如 SendGrid、Mailgun、AWS SES 等）
3. 测试邮件发送

---

## 快速测试步骤

1. ✅ 检查 Supabase Dashboard → Authentication → Settings → "Enable email confirmations"
2. ✅ 检查 Settings → API → Site URL 和 Redirect URLs
3. ✅ 检查邮箱的垃圾邮件文件夹
4. ✅ 查看浏览器控制台的日志
5. ✅ 检查 Supabase Dashboard → auth.users 表

如果以上都正常但仍未收到邮件，可能是 Supabase 的默认邮件服务延迟，建议：
- 等待几分钟后再次检查
- 或配置自定义 SMTP
- 或临时禁用邮箱验证（仅开发环境）

