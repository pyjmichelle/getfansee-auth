# 认证功能测试指南

## 修复内容总结

### ✅ 已修复的问题

1. **注册卡住问题**
   - **原因**：注册后立即调用 `ensureProfile()`，但此时还没有 session（需要邮箱验证）
   - **修复**：移除注册时的 `ensureProfile()` 调用，改为在邮箱验证后（`/auth/verify` 页面）创建 profile

2. **Session 获取错误**
   - **原因**：使用 `getUser()` 在没有 session 时会抛出 "Auth session missing!" 错误
   - **修复**：改用 `getSession()`，不会抛出错误

3. **Supabase 客户端配置**
   - 添加了更好的错误提示
   - 配置了 session 持久化和自动刷新

---

## 完整测试流程

### 前置条件

1. ✅ 已执行 `migrations/001_init.sql`（在 Supabase Dashboard → SQL Editor）
2. ✅ `.env.local` 文件已创建并配置了正确的 Supabase URL 和 Key
3. ✅ 开发服务器已启动：`pnpm run dev`

---

### 测试 1：Email + Password 注册

**步骤**：
1. 访问 `http://localhost:3000/auth`
2. 切换到 "Sign up" tab
3. 输入新邮箱（如 `test1@example.com`）
4. 输入密码（≥8 字符）
5. ✅ 勾选 "I confirm that I am 18+..."
6. 点击 "Sign up with email"

**预期结果**：
- ✅ 按钮显示 "Please wait..." 然后恢复正常
- ✅ 显示绿色提示框："Check your email for a confirmation link..."
- ✅ **不会卡住**
- ✅ 在 Supabase Dashboard → `auth.users` 表看到新用户（但 `email_confirmed_at` 为 `null`）
- ✅ 在 Supabase Dashboard → `profiles` 表**暂时看不到**新行（因为还没验证邮箱）

**验证邮箱验证**：
1. 打开邮箱，点击验证链接
2. 浏览器跳转到 `/auth/verify?token=...&type=signup`
3. 页面显示 "Verifying..." → "Verification successful!" → 自动跳转到 `/home`
4. ✅ 在 Supabase Dashboard → `profiles` 表**现在能看到**新行：
   - `id` = 用户的 UUID
   - `email` = `test1@example.com`
   - `display_name` = `test1`
   - `role` = `fan`
   - `age_verified` = `false`

---

### 测试 2：Email + Password 登录

**步骤**：
1. 访问 `http://localhost:3000/auth`
2. 切换到 "Log in" tab
3. 输入已注册并验证过的邮箱和密码
4. 点击 "Log in"

**预期结果**：
- ✅ 登录成功，自动跳转到 `/home`
- ✅ 在 Supabase Dashboard → `profiles` 表确认该用户的 profile 存在
- ✅ 如果 profile 不存在，会自动创建（兜底逻辑）

---

### 测试 3：Magic Link 注册/登录

**步骤**：
1. 访问 `http://localhost:3000/auth`
2. 切换到 "Sign up" tab
3. 输入邮箱（可以是新邮箱或已存在的邮箱）
4. 点击 "Send magic link to my email"

**预期结果**：
- ✅ 显示提示："Magic link sent. Please check your email..."
- ✅ 打开邮箱，点击 Magic Link
- ✅ 浏览器跳转到 `/auth/verify`
- ✅ 自动验证并创建 profile（如果是新用户）
- ✅ 自动跳转到 `/home`

---

### 测试 4：Google OAuth（如果已配置）

**步骤**：
1. 访问 `http://localhost:3000/auth`
2. 点击 "Continue with Google"
3. 完成 Google 授权

**预期结果**：
- ✅ 浏览器重定向到 `/auth/verify`
- ✅ 自动创建 profile（如果是新用户）
- ✅ 自动跳转到 `/home`

---

### 测试 5：/home 页面兜底逻辑

**步骤**：
1. 确保已登录（有 session）
2. 在 Supabase Dashboard → `profiles` 表手动删除该用户的 profile 行
3. 访问 `http://localhost:3000/home`

**预期结果**：
- ✅ 页面不会报错或卡死
- ✅ 短暂显示 "Loading..." 后正常显示内容
- ✅ 在 Supabase Dashboard → `profiles` 表确认 profile 已自动重新创建

---

### 测试 6：未登录访问 /home

**步骤**：
1. 退出登录（或清除 cookies）
2. 直接访问 `http://localhost:3000/home`

**预期结果**：
- ✅ 自动重定向到 `/auth`
- ✅ 不会出现 "Auth session missing!" 错误

---

## 常见问题排查

### 问题：注册后卡在 "Please wait..."

**可能原因**：
1. 环境变量未正确加载
2. Supabase 请求失败（网络问题或配置错误）

**排查步骤**：
1. 打开浏览器控制台（F12 → Console）
2. 查看是否有 Supabase 相关的错误信息
3. 检查 `.env.local` 文件是否存在且内容正确
4. 重启开发服务器（Ctrl+C 然后 `pnpm run dev`）

### 问题：显示 "Failed to fetch"

**可能原因**：
1. Supabase URL 或 Key 配置错误
2. 网络连接问题
3. Supabase 项目未启用或配置错误

**排查步骤**：
1. 检查 `.env.local` 中的 URL 和 Key 是否正确
2. 在浏览器 Network 标签查看失败的请求详情
3. 确认 Supabase Dashboard 可以正常访问

### 问题：Profile 未创建

**可能原因**：
1. RLS 策略阻止插入
2. Migration 未执行
3. 邮箱未验证（注册后需要验证才能创建 profile）

**排查步骤**：
1. 确认已执行 `migrations/001_init.sql`
2. 确认邮箱已通过验证（点击验证链接）
3. 检查 Supabase Dashboard → `profiles` 表的 RLS 策略

---

## 代码关键点

### 注册流程
```
用户注册 → signUpWithEmail() → Supabase 发送验证邮件
→ 用户点击邮件链接 → 跳转到 /auth/verify
→ verifyOtp() → 创建 session → ensureProfile() → 跳转到 /home
```

### 登录流程
```
用户登录 → signInWithEmail() → 创建 session
→ ensureProfile() → 跳转到 /home
```

### Profile 创建时机
- ✅ 邮箱验证后（`/auth/verify` 页面）
- ✅ 登录时（如果不存在）
- ✅ 访问 `/home` 时（兜底逻辑）

---

## 验证清单

- [ ] 注册不会卡住
- [ ] 注册后收到验证邮件
- [ ] 点击验证链接后自动创建 profile
- [ ] 登录功能正常
- [ ] Magic Link 功能正常
- [ ] Google OAuth 功能正常（如果已配置）
- [ ] `/home` 页面兜底逻辑正常
- [ ] 未登录访问 `/home` 会重定向到 `/auth`
- [ ] 所有操作都在 Supabase 数据库中正确记录

---

## 关闭 Email Confirmation 的测试流程

### 前置条件

1. ✅ 在 Supabase Dashboard → Authentication → Settings
2. ✅ 关闭 **"Enable email confirmations"** 选项
3. ✅ 保存设置

**注意**：关闭邮箱验证后，注册会立即创建 session，不需要邮箱验证。

---

### 测试流程（关闭 Email Confirmation）

#### Step 1: 注册新用户

1. 访问 `http://localhost:3000/auth`
2. 切换到 "Sign up" tab
3. 输入**新邮箱**（如 `test-no-confirm@example.com`）
4. 输入密码（≥8 字符）
5. ✅ 勾选 "I confirm that I am 18+..."
6. 点击 "Sign up with email"

**预期结果**：
- ✅ 在浏览器控制台（F12 → Console）看到：
  ```
  [auth] signUp response: { hasUser: true, hasSession: true, userId: "...", error: "none" }
  ```
- ✅ **立即跳转到 `/home`**（不需要邮箱验证）
- ✅ 在 Supabase Dashboard → `auth.users` 表看到新用户
- ✅ 用户的 `email_confirmed_at` **有日期**（自动确认）
- ✅ 在 Supabase Dashboard → `profiles` 表**立即看到**新行：
  - `id` = 用户的 UUID
  - `email` = `test-no-confirm@example.com`
  - `display_name` = `test-no-confirm`
  - `role` = `fan`
  - `age_verified` = `false`

#### Step 2: 验证 Session 和 Profile

1. 在 `/home` 页面，刷新浏览器（F5）
2. ✅ 用户仍然保持登录状态，不会跳转回 `/auth`
3. ✅ 在浏览器控制台看到：
  ```
  [home] Has session, ensuring profile for user: ...
  ```

#### Step 3: 验证登录流程

1. 退出登录（或清除 cookies）
2. 访问 `http://localhost:3000/auth`
3. 切换到 "Log in" tab
4. 输入刚才注册的邮箱和密码
5. 点击 "Log in"

**预期结果**：
- ✅ 在浏览器控制台看到：
  ```
  [auth] signIn response: { hasUser: true, hasSession: true, userId: "...", error: "none" }
  ```
- ✅ **立即跳转到 `/home`**
- ✅ 在 Supabase Dashboard → `auth.users` 表看到 `last_sign_in_at` 有日期

---

### 对比：开启 vs 关闭 Email Confirmation

| 场景 | 开启 Email Confirmation | 关闭 Email Confirmation |
|------|------------------------|------------------------|
| 注册后 | `hasSession: false`，需要邮箱验证 | `hasSession: true`，立即登录 |
| 跳转 | 显示 "Check your email..."，等待验证 | 立即跳转到 `/home` |
| Profile 创建 | 在 `/auth/verify` 页面创建 | 在注册时立即创建 |
| `email_confirmed_at` | 需要点击邮件链接后才确认 | 注册时自动确认 |

---

### 验证证据（Console 输出）

在开发环境（`NODE_ENV=development`）中，所有认证操作都会在控制台打印验证证据：

**注册时**：
```javascript
[auth] signUp response: {
  hasUser: true,
  hasSession: true,  // 或 false（取决于 Email Confirmation 设置）
  userId: "2e7148db-476d-452f-b01d-7a89c7bb98fa",
  error: "none"
}
```

**登录时**：
```javascript
[auth] signIn response: {
  hasUser: true,
  hasSession: true,
  userId: "2e7148db-476d-452f-b01d-7a89c7bb98fa",
  error: "none"
}
```

**/home 页面加载时**：
```javascript
[home] Has session, ensuring profile for user: 2e7148db-476d-452f-b01d-7a89c7bb98fa
```

---

### 完整闭环验证（关闭 Email Confirmation）

1. ✅ 注册 → 控制台显示 `hasSession: true` → 立即跳转 `/home`
2. ✅ `/home` 页面 → 控制台显示 "Has session, ensuring profile" → Profile 已存在
3. ✅ 刷新 `/home` → 仍然登录，不会跳转 `/auth`
4. ✅ 退出登录 → 登录 → 控制台显示 `hasSession: true` → 跳转 `/home`
5. ✅ Supabase Dashboard → `auth.users` 有 `last_sign_in_at`
6. ✅ Supabase Dashboard → `profiles` 有对应行

---

## 代码关键点（更新）

### 注册流程（按 session 真实状态）

```
用户注册 → signUpWithEmail() → 检查 data.session

如果 data.session 存在：
  → ensureProfile() → router.push('/home')（立即登录）

如果 data.session 不存在：
  → 显示 "Check your email..." → 等待邮箱验证
  → 用户点击邮件链接 → /auth/verify
  → exchangeCodeForSession() → ensureProfile() → router.replace('/home')
```

### 登录流程

```
用户登录 → signInWithEmail() → 创建 session
→ ensureProfile() → router.push('/home')
```

### /home 页面兜底逻辑

```
页面加载 → supabase.auth.getSession()
→ 没有 session → router.push('/auth')
→ 有 session → ensureProfile() → 保证 profiles 一定存在
```

