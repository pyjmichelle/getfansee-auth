-- 009_phase3_storage.sql
-- Phase 3: Storage 配置
-- Execute this in Supabase Dashboard SQL Editor

-- ============================================
-- 1. Create Storage Bucket: media
-- ============================================

-- 注意：Storage bucket 需要通过 Supabase Dashboard 的 Storage 页面创建
-- 或者使用 Supabase CLI，这里提供 SQL 方式（如果支持）

-- 如果 bucket 不存在，创建它
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'media',
  'media',
  false, -- 私有 bucket，使用 signed URL
  209715200, -- 200MB (200 * 1024 * 1024)
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================
-- 2. Storage Policies for INSERT
-- ============================================

-- 删除旧策略（如果存在）
DROP POLICY IF EXISTS "Users can upload to their own folder" ON storage.objects;
DROP POLICY IF EXISTS "media_insert_own_folder" ON storage.objects;

-- INSERT: 只允许登录用户写入自己的目录 (userId/yyyy-mm/*)
CREATE POLICY "media_insert_own_folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'media' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================
-- 3. Storage Policies for SELECT
-- ============================================

-- 删除旧策略（如果存在）
DROP POLICY IF EXISTS "Users can view their own files" ON storage.objects;
DROP POLICY IF EXISTS "media_select_own" ON storage.objects;
DROP POLICY IF EXISTS "media_select_public" ON storage.objects;

-- SELECT: 用户可以查看自己上传的文件
CREATE POLICY "media_select_own"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'media'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- SELECT: 公开文件（如果未来需要，可以基于 posts.is_locked 判断）
-- MVP 阶段：所有文件都需要 signed URL，这里先不创建公开策略
-- 如果需要公开访问，可以添加：
-- CREATE POLICY "media_select_public"
-- ON storage.objects
-- FOR SELECT
-- TO public
-- USING (bucket_id = 'media' AND ...);

-- ============================================
-- 4. Storage Policies for DELETE
-- ============================================

-- 删除旧策略（如果存在）
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;
DROP POLICY IF EXISTS "media_delete_own" ON storage.objects;

-- DELETE: 只允许用户删除自己上传的文件
CREATE POLICY "media_delete_own"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'media'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================
-- 5. Verify Storage Configuration
-- ============================================

-- 验证 bucket 是否存在
SELECT 
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets
WHERE id = 'media';

-- 验证 policies
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname LIKE 'media_%'
ORDER BY policyname;



