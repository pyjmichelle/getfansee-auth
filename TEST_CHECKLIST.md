# 测试检查清单

## 邮箱验证闭环测试（最小验收步骤）

### 前置条件

1. ✅ Supabase Dashboard → Settings → API → URL Configuration：
   - **Site URL**：开发环境可留空或填 `http://localhost:3000`，生产环境填实际域名
   - **Redirect URLs** 必须包含：
     - `http://localhost:3000/auth/verify`（本地开发）
     - `https://getfansee-auth.vercel.app/auth/verify`（Vercel 部署）
     - 你的生产域名 `/auth/verify`

2. ✅ 已执行 `migrations/001_init.sql`（创建 profiles 表和相关 RLS 策略）

3. ✅ `.env.local` 已配置正确的 Supabase URL 和 Key

---

## 完整测试流程

### Step 1: 注册新用户

1. 访问 `http://localhost:3000/auth`（本地）或 `https://getfansee-auth.vercel.app/auth`（线上）
2. 切换到 "Sign up" tab
3. 输入**新邮箱**（如 `test-verify@example.com`）
4. 输入密码（≥8 字符）
5. ✅ 勾选 "I confirm that I am 18+..."
6. 点击 "Sign up with email"

**预期结果**：

- ✅ 显示绿色提示框："Check your email for a confirmation link..."
- ✅ 显示两个按钮："Open Gmail / I've confirmed" 和 "Resend email"
- ✅ 在 Supabase Dashboard → Authentication → Users 看到新用户
- ✅ 用户的 `email_confirmed_at` 为 `null`（未验证）

---

### Step 2: 检查邮箱

1. 打开邮箱（检查收件箱和垃圾邮件文件夹）
2. 找到来自 Supabase 的验证邮件
3. 点击邮件中的验证链接

**预期结果**：

- ✅ 浏览器跳转到 `/auth/verify?code=...`（新格式）或 `/auth/verify?token=...&type=signup`（旧格式）
- ✅ 或跳转到 `/auth/verify#error=...`（如果链接过期）

---

### Step 3: 验证成功闭环

**如果链接有效**：

1. 页面显示 "Verifying..." → "Verification successful!"
2. 自动跳转到 `/home`
3. ✅ 在浏览器控制台（F12 → Console）看到：
   ```
   [verify] Processing code exchange
   [verify] Code exchange successful, user: test-verify@example.com
   ```
4. ✅ 在 Supabase Dashboard → Authentication → Users：
   - 该用户的 `email_confirmed_at` 有日期（已验证）
   - `last_sign_in_at` 有日期（已登录）
5. ✅ 在 Supabase Dashboard → Table Editor → `profiles` 表：
   - 看到新行，字段：
     - `id` = 用户的 UUID
     - `email` = `test-verify@example.com`
     - `display_name` = `test-verify`
     - `role` = `fan`
     - `age_verified` = `false`

**如果链接过期**：

1. 页面显示错误："Email link has expired. Please request a new verification email."
2. 显示 "Resend Confirmation Email" 按钮
3. 点击按钮重新发送验证邮件
4. 重复 Step 2-3

---

### Step 4: 验证 Session 持久化

1. 在 `/home` 页面，刷新浏览器（F5）
2. ✅ 用户仍然保持登录状态，不会跳转回 `/auth`
3. ✅ 在浏览器控制台（F12 → Application → Cookies）看到 Supabase session cookie

---

## 验收标准（必须全部通过）

- [ ] ✅ 注册后收到验证邮件
- [ ] ✅ 点击验证链接后成功跳转到 `/auth/verify`
- [ ] ✅ `/auth/verify` 页面正确处理 `code` 参数（优先）或 `token` 参数（兼容）
- [ ] ✅ 验证成功后自动跳转到 `/home`
- [ ] ✅ Supabase Dashboard → `auth.users` 表中用户的 `email_confirmed_at` 有日期
- [ ] ✅ Supabase Dashboard → `auth.users` 表中用户的 `last_sign_in_at` 有日期
- [ ] ✅ Supabase Dashboard → `profiles` 表中有对应的用户行
- [ ] ✅ 刷新 `/home` 页面后用户仍然保持登录状态
- [ ] ✅ 如果验证链接过期，显示明确的错误信息和 "Resend" 按钮

---

## 截图要求

完成测试后，请提供以下截图：

1. **verify 成功跳转 /home**：
   - 浏览器地址栏显示 `/home`
   - 页面正常显示内容（不是空白或错误）

2. **Supabase auth users 有 last sign in**：
   - Supabase Dashboard → Authentication → Users
   - 找到测试用户，确认 `last_sign_in_at` 字段有日期

3. **profiles 有对应行**：
   - Supabase Dashboard → Table Editor → `profiles` 表
   - 找到测试用户的 profile 行，显示所有字段

---

## 常见问题排查

### 问题 1：点击验证链接后显示 "Invalid redirect URL"

**原因**：Supabase Redirect URLs 配置不正确

**解决**：

1. 检查 Supabase Dashboard → Settings → API → Redirect URLs
2. 确保包含：`http://localhost:3000/auth/verify`（本地）和 `https://getfansee-auth.vercel.app/auth/verify`（线上）
3. 保存后重新发送验证邮件

### 问题 2：验证链接过期

**原因**：链接已过期（通常 24 小时）

**解决**：

1. 在 `/auth/verify` 页面点击 "Resend Confirmation Email"
2. 或访问 `/auth/resend-verification` 页面重新发送

### 问题 3：验证后没有创建 profile

**原因**：RLS 策略阻止插入，或 `ensureProfile()` 未执行

**解决**：

1. 检查 Supabase Dashboard → Table Editor → `profiles` 表的 RLS 策略
2. 确认已执行 `migrations/001_init.sql`
3. 检查浏览器控制台是否有错误

### 问题 4：验证后跳转失败

**原因**：`router.replace("/home")` 执行失败

**解决**：

1. 检查浏览器控制台是否有错误
2. 确认 `/home` 页面存在且可访问
3. 检查 Next.js 路由配置

---

## 本地 vs 线上测试

### 本地开发（localhost:3000）

- Site URL：可留空或填 `http://localhost:3000`
- Redirect URLs：`http://localhost:3000/auth/verify`

### Vercel 部署（getfansee-auth.vercel.app）

- Site URL：`https://getfansee-auth.vercel.app`
- Redirect URLs：`https://getfansee-auth.vercel.app/auth/verify`

### 生产环境（www.getfansee.com）

- Site URL：`https://www.getfansee.com`
- Redirect URLs：`https://www.getfansee.com/auth/verify`

---

## 测试完成后

如果所有验收标准都通过，请：

1. ✅ 提供 3 张截图（如上所述）
2. ✅ 确认 Supabase URL Configuration 已正确配置
3. ✅ 确认代码已部署到 Vercel（如果测试线上环境）
