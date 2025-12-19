# Supabase Redirect URL 配置指南

## ⚠️ 重要：必须配置 Redirect URLs

如果不配置正确的 Redirect URLs，用户点击邮箱验证链接或 OAuth 回调时会跳转失败，导致无法完成验证。

---

## 配置步骤

### 1. 登录 Supabase Dashboard

访问 [https://app.supabase.com](https://app.supabase.com) 并登录你的项目。

### 2. 进入 URL 配置页面

1. 点击左侧菜单 **Settings**（设置）
2. 点击 **API** 子菜单
3. 找到 **"URL Configuration"** 部分

### 3. 配置 Site URL（可选，开发环境）

**开发环境**：
- 可以留空
- 或填写：`http://localhost:3000`

**生产环境**：
- 填写你的实际域名，例如：`https://www.getfansee.com`

### 4. 配置 Redirect URLs（必须）

在 **"Redirect URLs"** 输入框中，添加以下 URL（每行一个）：

**开发环境**：
```
http://localhost:3000/auth/verify
```

**生产环境**：
```
https://www.getfansee.com/auth/verify
https://getfansee.com/auth/verify
```

**如果有多个环境**：
```
http://localhost:3000/auth/verify
https://staging.getfansee.com/auth/verify
https://www.getfansee.com/auth/verify
```

### 5. 保存配置

点击 **"Save"** 按钮保存配置。

---

## 验证配置

### 测试邮箱验证

1. 注册一个新用户
2. 检查邮箱中的验证链接
3. 点击链接，应该跳转到：`http://localhost:3000/auth/verify?token=...&type=signup`
4. 如果跳转到其他页面或显示错误，说明配置不正确

### 测试 OAuth（如果使用）

1. 点击 "Continue with Google"
2. 完成 Google 授权
3. 应该跳转回：`http://localhost:3000/auth/verify?code=...`
4. 如果跳转失败，检查 Redirect URLs 是否包含 `/auth/verify`

---

## 常见问题

### 问题 1：点击验证链接后显示 "Invalid redirect URL"

**原因**：Redirect URLs 中没有包含你的验证页面 URL。

**解决**：
1. 检查 Supabase Dashboard → Settings → API → Redirect URLs
2. 确保包含：`http://localhost:3000/auth/verify`（开发环境）
3. 保存后重新发送验证邮件

### 问题 2：OAuth 回调失败

**原因**：Redirect URLs 配置不正确或 OAuth 提供商的回调 URL 不匹配。

**解决**：
1. 检查 Supabase Dashboard → Authentication → Providers → Google → Redirect URL
2. 确保与 Supabase 的 Redirect URLs 配置一致
3. 确保 Google OAuth 控制台中的授权重定向 URI 也包含该 URL

### 问题 3：生产环境验证链接跳转错误

**原因**：生产环境的 Redirect URLs 没有配置。

**解决**：
1. 在 Supabase Dashboard 中添加生产环境的 URL
2. 格式：`https://你的域名/auth/verify`
3. 保存后重新测试

---

## 配置检查清单

- [ ] Site URL 已配置（生产环境必须）
- [ ] Redirect URLs 包含开发环境 URL：`http://localhost:3000/auth/verify`
- [ ] Redirect URLs 包含生产环境 URL：`https://你的域名/auth/verify`
- [ ] 已保存配置
- [ ] 已测试邮箱验证链接跳转
- [ ] 已测试 OAuth 回调（如果使用）

---

## 注意事项

1. **URL 必须完全匹配**：包括协议（http/https）、域名、端口、路径
2. **不要使用通配符**：Supabase 不支持 `*` 通配符
3. **每个环境都要添加**：开发、测试、生产环境都需要单独配置
4. **HTTPS 要求**：生产环境必须使用 HTTPS
5. **路径必须正确**：确保路径是 `/auth/verify`，不是 `/verify` 或其他

---

## 相关文档

- [Supabase Auth Redirect URLs](https://supabase.com/docs/guides/auth/auth-deep-dive/auth-deep-dive-jwts#redirect-urls)
- [Supabase OAuth Configuration](https://supabase.com/docs/guides/auth/social-login)

