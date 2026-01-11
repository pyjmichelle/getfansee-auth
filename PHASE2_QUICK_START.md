# Phase 2: 快速开始指南

## 📋 前置条件

### 1. 执行 SQL Migration

在 Supabase Dashboard SQL Editor 中执行：
- `migrations/011_phase2_upload.sql`

### 2. 更新 Storage Bucket 配置（手动）

在 Supabase Dashboard → Storage → media bucket → Settings：

1. **Max file size**: `2147483648` bytes (2GB)
2. **Allowed MIME types**: 
   ```
   image/jpeg, image/png, image/webp, video/mp4, video/quicktime
   ```

### 3. 环境变量

确保 `.env.local` 包含：
```bash
NEXT_PUBLIC_SUPABASE_URL=你的 Supabase URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的 Anon Key
```

---

## ✅ 验证步骤

### 1. Creator 创建 Post（多文件）

1. 登录 Creator 账号
2. 访问 `/creator/new-post`
3. 填写 content
4. 上传多个文件（图片 + 视频）
5. 选择 Visibility 和 Price（如需要）
6. 如果包含视频，可选择 "Enable Preview"
7. 点击 "发布"

**验证点**：
- ✅ 多个文件上传成功
- ✅ 文件预览正常
- ✅ Post 创建成功

### 2. Fan 查看内容（水印 + Preview）

1. 使用 Fan 账号登录
2. 访问 `/home` 或 `/creator/[id]`
3. 查看不同 visibility 的 post

**验证点**：
- ✅ Free post: 直接显示（无水印）
- ✅ Subscribers-only post: 遮罩 + "Subscribe to view"
- ✅ PPV post: 遮罩 + "Unlock for $X.XX"
- ✅ 视频 + preview_enabled: 显示前 10 秒
- ✅ 订阅后：Subscribers post 可见（图片带水印）
- ✅ 解锁后：PPV post 可见（图片带水印）

### 3. Creator 删除 Post

1. Creator 在 `/home` 看到自己的 post
2. 点击 post 右上角的删除按钮
3. 确认删除
4. 验证：post 从 feed 中移除

---

## 🎯 核心功能清单

- ✅ 多文件上传（图片 + 视频）
- ✅ 文件大小限制（图片 20MB，视频 2GB）
- ✅ 图片水印（半透明平铺，Creator display_name）
- ✅ 视频 Preview（前 10 秒）
- ✅ 内容删除（Creator 可删除自己的 post）
- ✅ 与现有 visibility/paywall 逻辑完全兼容

---

## 📊 技术实现

### 数据模型
- `post_media` 表：存储多个媒体资源
- `posts.preview_enabled`：是否开启视频 preview

### 水印生成
- 客户端生成（Canvas API）
- 仅对非 free 内容添加
- Creator 本人查看时不添加

### 视频 Preview
- 前端限制播放时间（10 秒）
- 10 秒后自动暂停并提示解锁/订阅

---

**完成时间**: _______________  
**测试人员**: _______________  



