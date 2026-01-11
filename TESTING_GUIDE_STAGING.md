# Staging 验收指南

## 📋 前置条件

### 1. Vercel 环境变量配置

在 Vercel Dashboard 中配置以下环境变量：

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Site URL（用于 OAuth 回调）
NEXT_PUBLIC_SITE_URL=https://your-staging.vercel.app

# Playwright（可选，用于 E2E 测试）
PLAYWRIGHT_BASE_URL=https://your-staging.vercel.app
```

### 2. Supabase 配置

#### 2.1 执行所有 SQL Migrations

在 Supabase Dashboard SQL Editor 中按顺序执行：

1. `migrations/001_init.sql` - 基础表结构
2. `migrations/004_fix_profiles_final.sql` - Profiles 表修复
3. `migrations/006_creator_onboarding.sql` - Creator onboarding
4. `migrations/007_phase1_posts.sql` - Posts 表
5. `migrations/008_phase2_paywall.sql` - Paywall 表
6. `migrations/009_phase3_storage.sql` - Storage 配置

#### 2.2 配置 Supabase Redirect URLs

在 Supabase Dashboard → Authentication → URL Configuration：

- **Site URL**: `https://your-staging.vercel.app`
- **Redirect URLs**: 
  - `https://your-staging.vercel.app/auth/verify`
  - `http://localhost:3000/auth/verify` (开发环境)

#### 2.3 创建 Storage Bucket

在 Supabase Dashboard → Storage：

1. 点击 "New bucket"
2. Name: `media`
3. Public: **关闭**（使用 signed URL）
4. File size limit: `200 MB`
5. Allowed MIME types: `image/jpeg, image/png, image/gif, image/webp, video/mp4, video/webm, video/quicktime`

---

## ✅ 验收步骤（10 分钟）

### 步骤 1: 自动化测试（2 分钟）

```bash
# 在本地运行（确保 .env.local 指向 staging Supabase）
pnpm test:paywall
pnpm test:e2e
```

**预期结果**：
- ✅ `test:paywall` 全绿（失败: 0）
- ✅ `test:e2e` 全绿（失败: 0）

### 步骤 2: Chrome 浏览器手动验证（4 分钟）

#### 2.1 注册和登录
1. 打开 `https://your-staging.vercel.app/auth`
2. 使用新邮箱注册（例如：`test-chrome-${timestamp}@example.com`）
3. 验证注册成功并跳转到 `/home`

#### 2.2 成为 Creator
1. 点击 "Become a Creator" 按钮
2. 填写 `display_name` 和 `bio`
3. 点击 "Save"
4. 验证跳转到 `/home` 且按钮变为 "Creator Dashboard"

#### 2.3 创建 Post（上传图片）
1. 点击 "Creator Dashboard" → 进入 `/creator/onboarding`
2. 点击 "Create New Post" 或直接访问 `/creator/new-post`
3. 拖拽或选择一张图片（< 10MB）
4. 验证上传进度条显示
5. 验证上传成功后显示预览
6. 填写 `content`（必填）
7. 勾选 "Lock Post"
8. 点击 "发布"
9. 验证跳转到 `/home` 且 post 显示在 feed 中

#### 2.4 订阅和查看 Locked Content
1. 使用另一个浏览器（或隐身模式）注册新用户（Fan）
2. 在 `/home` feed 中看到 Creator 的 locked post
3. 验证显示 "This content is locked" 遮罩
4. 点击 "Subscribe to unlock" 按钮
5. 验证订阅成功后遮罩消失，内容可见
6. 刷新页面，验证 locked 内容仍然可见

### 步骤 3: Safari 浏览器手动验证（4 分钟）

重复步骤 2 的所有操作，使用 Safari 浏览器：

1. 注册新用户
2. 成为 Creator
3. 上传图片并发布 locked post
4. 使用另一个用户订阅并查看 locked content

**验证点**：
- ✅ 所有功能在 Safari 中正常工作
- ✅ 上传功能正常
- ✅ 订阅功能正常
- ✅ Locked content 正确显示/隐藏

---

## 🐛 常见问题排查

### 问题 1: 上传失败

**可能原因**：
- Storage bucket 未创建
- Storage policies 未正确配置
- 文件大小超过限制

**解决方法**：
1. 检查 Supabase Dashboard → Storage 中是否存在 `media` bucket
2. 检查 Storage policies 是否正确（参考 `009_phase3_storage.sql`）
3. 检查文件大小（图片 < 10MB，视频 < 200MB）

### 问题 2: RLS 策略错误

**可能原因**：
- SQL migrations 未完全执行
- RLS policies 缺失或错误

**解决方法**：
1. 在 Supabase Dashboard → SQL Editor 中执行验证查询：
   ```sql
   SELECT tablename, policyname, cmd
   FROM pg_policies
   WHERE schemaname = 'public'
   ORDER BY tablename, policyname;
   ```
2. 确认所有必要的 policies 都存在

### 问题 3: OAuth 回调失败

**可能原因**：
- Redirect URLs 未正确配置
- Site URL 不匹配

**解决方法**：
1. 检查 Supabase Dashboard → Authentication → URL Configuration
2. 确保 Site URL 和 Redirect URLs 包含 staging URL

### 问题 4: E2E 测试失败

**可能原因**：
- 测试环境变量未配置
- 测试用户已存在（邮箱冲突）

**解决方法**：
1. 检查 `.env.local` 中的 `PLAYWRIGHT_BASE_URL`
2. 在 Supabase Dashboard 中手动删除测试用户（如果存在）

---

## 📊 验收清单

- [ ] `pnpm test:paywall` 全绿
- [ ] `pnpm test:e2e` 全绿
- [ ] Chrome 浏览器：注册 → Creator → 上传图片 → 发布 locked post → 订阅 → 查看
- [ ] Safari 浏览器：注册 → Creator → 上传图片 → 发布 locked post → 订阅 → 查看
- [ ] 上传进度条正常显示
- [ ] Locked content 遮罩正确显示/隐藏
- [ ] 订阅状态持久化（刷新页面保持）

---

## 🚀 完成标准

所有验收步骤通过后，Phase 3 完成！

**交付物**：
- ✅ Storage bucket 和 policies 配置完成
- ✅ 上传组件功能正常
- ✅ E2E 测试全绿
- ✅ Chrome + Safari 手动验证通过

---

**验收日期**: _______________  
**验收人员**: _______________  
**备注**: _______________



