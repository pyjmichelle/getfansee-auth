# 项目现状分析报告

**生成时间**: 2025-01-20  
**项目名称**: GetFanSee Authentication Flow Design  
**技术栈**: Next.js 16 (App Router), React 19, TypeScript, Supabase, Tailwind CSS

---

## 一、核心目录结构

### 1. `app/` - Next.js App Router 路由
- **认证相关**:
  - `auth/page.tsx` - 登录/注册页面（支持邮箱、Google、Magic Link）
  - `auth/verify/page.tsx` - 邮箱验证页面
  - `auth/error/` - 错误处理页面
- **核心页面**:
  - `home/page.tsx` - Feed 流页面（主要内容展示）
  - `me/page.tsx` - 个人资料页面
  - `test/page.tsx` - 测试入口页面（需 `NEXT_PUBLIC_TEST_MODE=true`）
- **创作者相关**:
  - `creator/[id]/page.tsx` - 创作者详情页
  - `creator/new-post/page.tsx` - 发布内容页面
  - `creator/studio/` - 创作者工作室（analytics, earnings, subscribers, post 管理）
  - `creator/onboarding/` - 创作者入驻流程
- **订阅与购买**:
  - `subscriptions/page.tsx` - 订阅管理页面
  - `purchases/page.tsx` - 购买记录页面

### 2. `components/` - UI 组件库
- **业务组件**:
  - `nav-header.tsx` - 导航头部（含用户菜单）
  - `media-display.tsx` - 媒体展示组件（图片/视频，支持水印和预览）
  - `paywall-modal.tsx` - 支付弹窗（订阅/PPV 解锁）
  - `multi-media-upload.tsx` - 多文件上传组件
  - `lock-overlay.tsx` / `lock-badge.tsx` - 内容锁定相关 UI
- **UI 基础组件** (`ui/`): 基于 **Radix UI** + **shadcn/ui**，包含 57 个组件（Button, Card, Dialog, Sheet, Avatar, Tabs 等）

### 3. `lib/` - 业务逻辑层
- `auth.ts` - 身份验证（登录、注册、Profile 创建）
- `profile.ts` - 用户资料管理（角色设置、资料更新）
- `posts.ts` - 内容管理（创建、查询 Feed、删除）
- `paywall.ts` - 付费墙逻辑（订阅、PPV 解锁、权限检查）
- `storage.ts` - Supabase Storage 文件上传（支持图片/视频，20MB/2GB 限制）
- `post-media.ts` - 多媒体文件关联管理
- `watermark.ts` - 水印处理（待实现）
- `creators.ts` - 创作者数据访问
- `supabase-client.ts` - Supabase 客户端初始化

### 4. `migrations/` - 数据库迁移文件
- **核心迁移**: `013_money_access_mvp.sql`（最新，定义完整 MVP Schema）
- **历史迁移**: 001-012 为分阶段开发的历史记录

### 5. `hooks/` - React Hooks
- `use-mobile.ts` - 响应式断点检测
- `use-toast.ts` - Toast 通知

---

## 二、数据库 Schema (Supabase)

### 1. `profiles` 表（用户基础信息）
```sql
- id: uuid (PK, FK → auth.users)
- email: text (NOT NULL)
- display_name: text
- role: text (NOT NULL, CHECK: 'fan' | 'creator', DEFAULT: 'fan')
- avatar_url: text
- bio: text
- age_verified: boolean (DEFAULT: false)
- created_at: timestamptz
- updated_at: timestamptz
```

**RLS 策略**:
- `profiles_select_own` - 用户只能查看自己的 profile
- `profiles_insert_own` - 用户只能创建自己的 profile
- `profiles_update_own` - 用户只能更新自己的 profile

### 2. `creators` 表（创作者扩展信息）
```sql
- id: uuid (PK, FK → auth.users)
- display_name: text (NOT NULL)
- avatar_url: text
- bio: text
- created_at: timestamptz
```

**关联关系**:
- 通过 Trigger `sync_profile_to_creator_trigger` 自动从 `profiles` 同步（当 `role='creator'` 时）

**RLS 策略**:
- `creators_select_all` - 所有认证用户可查看
- `creators_insert_self` - 用户可创建自己的 creator profile
- `creators_update_self` - 用户可更新自己的 creator profile

### 3. `posts` 表（内容发布）
```sql
- id: uuid (PK)
- creator_id: uuid (FK → creators.id)
- title: text
- content: text (NOT NULL)
- media_url: text (向后兼容，单个媒体)
- visibility: text (CHECK: 'free' | 'subscribers' | 'ppv')
- price_cents: integer (NOT NULL, DEFAULT: 0, CHECK: >= 0)
  - price_cents = 0: 订阅者专享（subscriber-only）
  - price_cents > 0: PPV（按次付费）
- preview_enabled: boolean (DEFAULT: false)
- watermark_enabled: boolean (DEFAULT: true)
- is_locked: boolean (向后兼容)
- cover_url: text
- created_at: timestamptz
```

**关联表**: `post_media`（多文件支持）
```sql
- id: uuid (PK)
- post_id: uuid (FK → posts.id, CASCADE DELETE)
- media_url: text (NOT NULL)
- watermarked_path: text
- media_type: text (CHECK: 'image' | 'video')
- file_name: text
- file_size: integer
- sort_order: integer
```

**RLS 策略** (`posts_select_visible`):
- Creator 本人可查看自己的所有 posts
- `price_cents = 0`（订阅者专享）: 需要 `subscriptions.status='active'` 且 `current_period_end > now()`
- `price_cents > 0`（PPV）: 需要 `purchases` 表中存在对应记录

### 4. `subscriptions` 表（订阅关系）
```sql
- id: uuid (PK)
- fan_id: uuid (FK → auth.users)
- creator_id: uuid (FK → creators.id)
- plan: text (NOT NULL, DEFAULT: 'monthly', CHECK: 'monthly' | 'yearly')
- status: text (CHECK: 'active' | 'canceled' | 'expired')
- current_period_end: timestamptz (NOT NULL)
- created_at: timestamptz
- updated_at: timestamptz
- UNIQUE(fan_id, creator_id)
```

**RLS 策略**: 用户只能查看/创建自己的订阅记录

### 5. `purchases` 表（PPV 购买记录）
```sql
- id: uuid (PK)
- fan_id: uuid (FK → auth.users)
- post_id: uuid (FK → posts.id, CASCADE DELETE)
- paid_amount_cents: integer (NOT NULL)
- created_at: timestamptz
- UNIQUE(fan_id, post_id)
```

**RLS 策略**:
- `purchases_select_own` - 用户只能查看自己的购买记录
- `purchases_insert_own` - 用户只能创建自己的购买记录

### 6. Database Functions
- `sync_profile_to_creator()` - 自动同步 `profiles` → `creators`（Trigger）
- `set_updated_at()` - 自动更新 `updated_at` 字段（Trigger）

---

## 三、身份验证与路由

### 1. 登录/注册流程
**实现位置**: `app/auth/page.tsx`, `lib/auth.ts`

**支持的认证方式**:
- 邮箱 + 密码登录/注册
- Google OAuth（`signInWithGoogle`）
- Magic Link（`signInWithMagicLink`）

**登录后跳转逻辑**:
```typescript
// app/auth/page.tsx:54-58
if (result?.session) {
  await ensureProfile()  // 确保 profile 存在
  router.push("/home")   // 无条件跳转到 /home
  return
}
```

**Profile 创建**:
- `ensureProfile()` 函数自动为新用户创建 `profiles` 记录（`role='fan'` 默认）

### 2. 角色区分与存储
**存储位置**: `profiles.role` 字段（`'fan'` | `'creator'`）

**角色切换**:
- 用户可通过 `/me` 页面或 `/creator/onboarding` 将 `role` 设置为 `'creator'`
- 当 `role='creator'` 时，Trigger 自动在 `creators` 表中创建/更新记录

**代码中的角色检查**:
```typescript
// lib/posts.ts:68
const profile = await getProfile(user.id)
if (!profile || profile.role !== "creator") {
  console.error("[posts] createPost: user is not a creator")
  return null
}
```

---

## 四、核心业务逻辑实现度

### 1. Feed 流 (`app/home/page.tsx`)

**数据获取**:
- 使用 `listFeed(limit: 20)` 函数（`lib/posts.ts:177`）
- 查询 `posts` 表并 JOIN `profiles` 获取创作者信息（`display_name`, `avatar_url`）
- 支持多文件媒体：通过 `getPostsMedia()` 加载 `post_media` 表数据

**图片/视频预览**:
- ✅ **已实现**: `MediaDisplay` 组件支持图片和视频展示
- ✅ **已实现**: 支持预览模式（`preview_enabled`）
- ✅ **已实现**: 支持水印（`watermark_enabled`，但水印生成逻辑待实现）
- ⚠️ **部分问题**: 部分免费内容的图片/视频 URL 可能失效（使用外部服务如 Picsum、sample-videos.com）

**权限控制**:
- 免费内容（`visibility='free'`）: 所有人可见
- 订阅者专享（`price_cents=0`）: 需要活跃订阅
- PPV（`price_cents>0`）: 需要购买记录

### 2. 支付/订阅 (`components/paywall-modal.tsx`)

**当前状态**: ⚠️ **纯 UI Mock，未对接真实支付 API**

**实现细节**:
```typescript
// components/paywall-modal.tsx:38-56
const handlePayment = async () => {
  setPaymentState("processing")
  await new Promise((resolve) => setTimeout(resolve, 2000))  // 模拟延迟
  const success = Math.random() > 0.1  // 随机成功/失败
  if (success) {
    setPaymentState("success")
    onSuccess()  // 回调触发真实的 subscribe30d() 或 unlockPost()
  }
}
```

**真实数据库操作**:
- ✅ `subscribe30d(creatorId)` - 创建/更新 `subscriptions` 记录（`lib/paywall.ts:19`）
- ✅ `unlockPost(postId, priceCents)` - 创建 `purchases` 记录（`lib/paywall.ts:137`）
- ⚠️ **缺失**: 真实支付网关集成（Stripe/PayPal 等）

**订阅管理**:
- ✅ `cancelSubscription(creatorId)` - 更新 `status='canceled'`
- ✅ `hasActiveSubscription(creatorId)` - 检查活跃订阅（基于 `current_period_end`）

### 3. 内容发布 (`app/creator/new-post/page.tsx`)

**文件上传功能**: ✅ **已实现，使用 Supabase Storage**

**实现方式**:
- 使用 `MultiMediaUpload` 组件（`components/multi-media-upload.tsx`）
- 调用 `uploadFiles()` 函数（`lib/storage.ts:159`）
- 上传到 Supabase Storage bucket: `media`
- 文件路径格式: `{creatorId}/{postId}/{mediaId}/{timestamp-uuid}.ext`
- 支持进度追踪和错误处理

**文件限制**:
- 图片: `image/jpeg`, `image/png`, `image/webp`，最大 20MB
- 视频: `video/mp4`, `video/quicktime`，最大 2GB

**发布流程**:
1. 用户填写 `title`, `content`
2. 选择 `visibility`（`'free'` | `'subscribers'` | `'ppv'`）
3. 如果 `visibility='ppv'`，必须设置 `price_cents > 0`
4. 上传媒体文件（可选，支持多文件）
5. 调用 `createPost()` 创建 `posts` 记录
6. 如果有媒体文件，调用 `addPostMedia()` 创建 `post_media` 记录

**水印功能**: ⚠️ **待实现**
- `watermark_enabled` 字段已存在，但 `lib/watermark.ts` 中的水印生成逻辑未完成

---

## 五、当前阻塞点 (Blockers)

### 1. 支付网关集成
**状态**: ❌ **未实现**  
**位置**: `components/paywall-modal.tsx:38-56`  
**影响**: 无法进行真实支付，目前为纯 UI Mock  
**建议**: 集成 Stripe 或 PayPal SDK

### 2. 头像上传功能
**状态**: ❌ **未实现**  
**位置**: `app/me/page.tsx:241`（有 `// TODO: Implement avatar upload` 注释）  
**影响**: 用户无法上传自定义头像，只能使用外部 URL  
**建议**: 复用 `lib/storage.ts` 的上传逻辑，创建 `avatars` bucket

### 3. 水印生成
**状态**: ⚠️ **部分实现**  
**位置**: `lib/watermark.ts`（文件存在但逻辑未完成）  
**影响**: `watermark_enabled=true` 的帖子无法显示水印  
**建议**: 实现图片/视频水印叠加逻辑（可使用 Canvas API 或 FFmpeg）

### 4. 媒体 URL 可靠性
**状态**: ⚠️ **部分问题**  
**位置**: `scripts/seed-feed-data.ts`（使用外部服务如 Picsum、sample-videos.com）  
**影响**: 部分免费内容的图片/视频可能无法加载  
**建议**: 将所有演示内容迁移到 Supabase Storage 或使用更可靠的 CDN

### 5. 订阅过期自动处理
**状态**: ⚠️ **未自动化**  
**位置**: `lib/paywall.ts:94-129`（只检查 `current_period_end > now()`）  
**影响**: 过期订阅的 `status` 不会自动更新为 `'expired'`  
**建议**: 创建 Supabase Edge Function 定时任务或使用 Cron Job

### 6. 邮箱验证流程
**状态**: ✅ **已实现但可能未配置**  
**位置**: `app/auth/verify/page.tsx`  
**影响**: 如果 Supabase 配置为需要邮箱验证，用户注册后需要验证才能登录  
**建议**: 确认 Supabase Dashboard 中的邮箱验证设置（`Authentication` → `Settings` → `Email Auth`）

---

## 六、技术栈总结

### 前端框架
- **Next.js 16.0.10** (App Router)
- **React 19.2.0**
- **TypeScript 5.x**

### UI 组件库
- **Radix UI** - 无样式组件基础
- **shadcn/ui** - 组件系统（57 个组件）
- **Tailwind CSS 4.1.9** - 样式框架
- **Lucide React** - 图标库

### 后端/数据库
- **Supabase** - BaaS 平台
  - PostgreSQL 数据库
  - Row Level Security (RLS)
  - Storage（文件存储）
  - Authentication（邮箱、Google OAuth）

### 工具库
- **date-fns 4.1.0** - 日期格式化
- **zod 3.25.76** - 数据验证
- **react-hook-form 7.60.0** - 表单管理
- **sonner 1.7.4** - Toast 通知

### 测试
- **Playwright 1.57.0** - E2E 测试框架
- 自定义测试脚本: `test-paywall.js`, `test-visibility.js`, `test-watermark.js`

---

## 七、部署状态

### 当前部署
- **平台**: Vercel
- **URL**: `https://getfansee-auth.vercel.app`
- **分支**: `main`
- **构建状态**: ✅ 正常（已解决之前的 Button 重复定义问题）

### 环境变量要求
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase 项目 URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase 匿名密钥
- `NEXT_PUBLIC_TEST_MODE` - 测试模式开关（`"true"` 启用 `/test` 页面）

---

## 八、下一步建议

### 高优先级
1. **集成支付网关**（Stripe/PayPal）- 阻塞核心功能
2. **实现头像上传** - 提升用户体验
3. **修复媒体 URL 可靠性** - 确保演示内容正常显示

### 中优先级
4. **实现水印生成** - 内容保护功能
5. **订阅过期自动化** - 数据一致性
6. **优化 Feed 性能** - 分页、虚拟滚动

### 低优先级
7. **E2E 测试覆盖** - 质量保证
8. **国际化支持** - 多语言
9. **推送通知** - 用户 engagement

---

**报告生成完成**  
如有疑问，请参考代码注释或联系开发团队。

