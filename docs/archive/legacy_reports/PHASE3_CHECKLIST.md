# Phase 3: 真实上传 + Staging 验收闭环 - 完成清单

## ✅ 完成内容

### 1. Storage 设计

- ✅ **SQL Migration**: `migrations/009_phase3_storage.sql`
  - 创建 `media` bucket（如果不存在）
  - 配置 file_size_limit: 200MB
  - 配置 allowed*mime_types: image/*, video/\_
  - INSERT policy: 只允许登录用户写入自己的目录 (`userId/yyyy-mm/*`)
  - SELECT policy: 用户可以查看自己上传的文件
  - DELETE policy: 用户可以删除自己上传的文件

### 2. 前端上传组件

- ✅ **`components/media-upload.tsx`**
  - 支持 `<input type="file">` 选择文件
  - 支持 drag & drop
  - 显示上传进度条（模拟进度）
  - 支持图片和视频预览
  - 上传成功后返回 signedUrl
  - 错误处理和用户反馈

- ✅ **`lib/storage.ts`**
  - `uploadFile(file, onProgress?)`: 上传文件到 Supabase Storage
  - `deleteFile(filePath)`: 删除文件
  - `extractFilePathFromUrl(signedUrl)`: 从 signed URL 提取文件路径
  - 文件类型验证（image/_, video/_）
  - 文件大小验证（图片 10MB，视频 200MB）
  - 路径规则：`userId/yyyy-mm/<uuid>.<ext>`

### 3. Post 创建页面集成

- ✅ **`app/creator/new-post/page.tsx`**
  - 集成 `MediaUpload` 组件
  - 上传成功后自动填充 `media_url`
  - Toast 通知（成功/失败）

### 4. Playwright E2E 测试

- ✅ **`playwright.config.ts`**: Playwright 配置
- ✅ **`e2e/paywall-flow.spec.ts`**: E2E 测试脚本
  - 测试完整流程：注册 → Creator → 上传图片 → 发布 locked post → 订阅 → 查看
  - 测试上传视频功能
  - 支持 Chrome, Firefox, Safari

- ✅ **`package.json`** 新增脚本：
  - `pnpm test:e2e`: 运行 E2E 测试
  - `pnpm test:e2e:ui`: 运行 E2E 测试（UI 模式）

### 5. Staging 部署指南

- ✅ **`TESTING_GUIDE_STAGING.md`**: 完整的 Staging 验收指南
  - Vercel 环境变量配置
  - Supabase 配置步骤
  - 10 分钟验收流程
  - Chrome + Safari 手动验证步骤
  - 常见问题排查

---

## 📋 下一步操作

### 1. 安装 Playwright（如果未安装）

```bash
pnpm install
npx playwright install
```

### 2. 执行 SQL Migration

在 Supabase Dashboard SQL Editor 中执行：

- `migrations/009_phase3_storage.sql`

**注意**：Storage bucket 需要通过 Supabase Dashboard 手动创建（SQL 可能不支持），然后执行 policies 部分。

### 3. 创建 Storage Bucket（手动）

在 Supabase Dashboard → Storage：

1. 点击 "New bucket"
2. Name: `media`
3. Public: **关闭**
4. File size limit: `200 MB`
5. Allowed MIME types: `image/jpeg, image/png, image/gif, image/webp, video/mp4, video/webm, video/quicktime`

### 4. 运行测试

```bash
# Paywall 测试
pnpm test:paywall

# E2E 测试（需要先启动 dev server）
pnpm test:e2e
```

### 5. Staging 部署

参考 `TESTING_GUIDE_STAGING.md` 进行：

1. 配置 Vercel 环境变量
2. 配置 Supabase Redirect URLs
3. 执行所有 SQL migrations
4. 运行自动化测试
5. Chrome + Safari 手动验证

---

## 🎯 交付标准

- ✅ `pnpm test:paywall` 全绿
- ✅ `pnpm test:e2e` 全绿（需要手动创建测试文件或使用 mock）
- ✅ Staging 上手工按文档操作：Chrome + Safari 各通过一次

---

## 📁 新增文件清单

### 数据库

- `migrations/009_phase3_storage.sql`

### 代码

- `lib/storage.ts` - Storage 工具函数
- `components/media-upload.tsx` - 上传组件

### 测试

- `playwright.config.ts` - Playwright 配置
- `e2e/paywall-flow.spec.ts` - E2E 测试

### 文档

- `TESTING_GUIDE_STAGING.md` - Staging 验收指南
- `PHASE3_CHECKLIST.md` - 本文件

---

## ⚠️ 注意事项

1. **Storage Bucket 创建**：SQL migration 可能无法创建 bucket，需要手动在 Supabase Dashboard 中创建
2. **上传进度**：Supabase Storage 不支持实时进度，当前使用模拟进度
3. **E2E 测试**：需要真实的文件上传，可能需要调整测试以使用实际文件或 mock
4. **Signed URL 有效期**：当前设置为 1 年，可根据需要调整

---

**完成时间**: **\*\***\_\_\_**\*\***  
**测试人员**: **\*\***\_\_\_**\*\***  
**备注**: **\*\***\_\_\_**\*\***
