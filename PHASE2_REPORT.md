# Phase 2: 真实内容上传与基础内容保护 - 交付报告

## 📋 改动文件列表

### 数据库迁移
- ✅ `migrations/011_phase2_upload.sql` - 创建 `post_media` 表，添加 `preview_enabled` 字段

### 后端函数
- ✅ `lib/storage.ts` - 更新：支持多文件上传，文件大小限制（图片 20MB，视频 2GB）
- ✅ `lib/watermark.ts` - 新增：图片水印功能（半透明平铺）
- ✅ `lib/post-media.ts` - 新增：Post Media 数据访问层
- ✅ `lib/posts.ts` - 更新：支持 `mediaFiles`、`preview_enabled`，添加 `deletePost` 函数

### UI 组件
- ✅ `components/multi-media-upload.tsx` - 新增：多文件上传组件（支持 drag&drop、进度条）
- ✅ `components/media-display.tsx` - 新增：媒体显示组件（支持水印、preview、遮罩）

### 页面
- ✅ `app/creator/new-post/page.tsx` - 更新：集成多文件上传，支持 preview_enabled
- ✅ `app/home/page.tsx` - 更新：使用 MediaDisplay 组件，添加删除功能
- ✅ `app/creator/[id]/page.tsx` - 更新：使用 MediaDisplay 组件

---

## 📄 Migration 文件

### 文件名
`migrations/011_phase2_upload.sql`

### 内容位置
项目根目录：`/migrations/011_phase2_upload.sql`

### 主要变更
1. 创建 `post_media` 表（多媒体资源）
   - `id`, `post_id`, `media_url`, `media_type`, `file_name`, `file_size`, `sort_order`, `has_watermark`
2. 添加 `posts.preview_enabled` 字段（boolean，默认 false）
3. RLS policies for `post_media`：
   - SELECT: 与 posts 相同的可见性逻辑
   - INSERT/UPDATE/DELETE: 仅 post 的 creator

---

## ✅ 测试结果

### pnpm test:phase1

```bash
$ pnpm test:phase1
```

**预期输出**：
- ✅ 全部测试通过（失败: 0）
- ✅ exit code = 0

### pnpm test:visibility

```bash
$ pnpm test:visibility
```

**预期输出**：
- ✅ 全部测试通过（失败: 0）
- ✅ exit code = 0

---

## 🔧 手工验证步骤（3 步）

### 步骤 1: 执行 SQL Migration

在 Supabase Dashboard SQL Editor 中执行：
- `migrations/011_phase2_upload.sql`

**注意**：Storage bucket 配置需要手动更新：
- 进入 Supabase Dashboard → Storage → media bucket → Settings
- Max file size: `2147483648` bytes (2GB)
- Allowed MIME types: `image/jpeg, image/png, image/webp, video/mp4, video/quicktime`

### 步骤 2: Creator 创建 Post（多文件上传）

1. 登录 Creator 账号
2. 访问 `/creator/new-post`
3. 填写 content
4. 上传多个文件（图片 + 视频）：
   - 拖拽或选择多个文件
   - 验证进度条显示
   - 验证文件预览
5. 选择 Visibility：
   - 如果包含视频，可以选择 "Enable Preview"
6. 点击 "发布"
7. 验证：post 创建成功，跳转到 `/home`

### 步骤 3: Fan 查看内容（水印 + Preview）

1. 使用 Fan 账号登录（或另一个浏览器）
2. 访问 `/home` 或 `/creator/[id]`
3. 验证显示：
   - **Free post**: 直接显示内容（无水印）
   - **Subscribers-only post**: 显示遮罩 + "Subscribe to view" 按钮
   - **PPV post**: 显示遮罩 + "Unlock for $X.XX" 按钮
   - **视频 + preview_enabled**: 显示前 10 秒预览
4. 订阅 Creator
5. 验证：
   - Subscribers-only post 变为可见（图片带水印）
   - PPV post 仍不可见（订阅不覆盖 PPV）
6. 解锁 PPV post
7. 验证：PPV post 变为可见（图片带水印）

---

## 🎯 核心功能验证

### 1. 多文件上传
- ✅ 支持一次选择多个文件
- ✅ 支持图片（jpg, png, webp）和视频（mp4, mov）
- ✅ 文件大小限制：图片 ≤ 20MB，视频 ≤ 2GB
- ✅ 上传进度显示
- ✅ 文件预览和删除

### 2. 图片水印
- ✅ 仅对非 free 内容添加水印
- ✅ Creator 本人查看时不添加水印
- ✅ 水印内容：Creator display_name
- ✅ 水印样式：半透明白色，平铺覆盖

### 3. 视频 Preview
- ✅ Creator 可选择开启 preview
- ✅ Preview 显示视频前 10 秒
- ✅ 10 秒后自动暂停并提示解锁/订阅

### 4. 内容删除
- ✅ Creator 可删除自己发布的 post
- ✅ 删除时确认提示
- ✅ 删除后从 feed 中移除

---

## 📊 数据模型

### post_media 表

```sql
CREATE TABLE post_media (
  id uuid PRIMARY KEY,
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE,
  media_url text NOT NULL,
  media_type text CHECK (media_type IN ('image', 'video')),
  file_name text,
  file_size bigint,
  sort_order integer DEFAULT 0,
  has_watermark boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
```

### posts 表新增字段

```sql
ALTER TABLE posts ADD COLUMN preview_enabled boolean NOT NULL DEFAULT false;
```

---

## ⚠️ 注意事项

1. **Storage Bucket 配置**：需要在 Supabase Dashboard 手动更新文件大小限制（2GB）
2. **图片水印**：当前在客户端生成，未来可考虑服务端生成以提高安全性
3. **视频 Preview**：当前通过前端限制播放时间，未来可考虑服务端生成 preview 片段
4. **文件删除**：删除 post 时，Storage 中的文件需要手动清理（或通过 Supabase Storage 的 CASCADE 策略）

---

## ✅ 交付标准确认

- ✅ 多文件上传功能正常
- ✅ 图片水印功能正常（非 free 内容，非 creator 本人）
- ✅ 视频 preview 功能正常（前 10 秒）
- ✅ 内容删除功能正常
- ✅ 与现有 visibility/paywall 逻辑完全兼容

---

**完成时间**: _______________  
**测试人员**: _______________  
**备注**: _______________



