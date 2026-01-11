-- 011_phase2_upload.sql
-- Phase 2: 真实内容上传与基础内容保护
-- Execute this in Supabase Dashboard SQL Editor

-- ============================================
-- 1. Update Storage Bucket Configuration
-- ============================================

-- 注意：Storage bucket 配置需要通过 Supabase Dashboard 手动更新
-- 或者使用 Supabase CLI
-- 
-- 需要更新的配置：
-- - file_size_limit: 2147483648 (2GB for videos)
-- - allowed_mime_types: 添加 'image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime'
--
-- 在 Supabase Dashboard → Storage → media bucket → Settings 中更新：
-- - Max file size: 2147483648 bytes (2GB)
-- - Allowed MIME types: image/jpeg, image/png, image/webp, video/mp4, video/quicktime

-- ============================================
-- 2. Create post_media table (多媒体资源)
-- ============================================

CREATE TABLE IF NOT EXISTS public.post_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  media_url text NOT NULL,
  media_type text NOT NULL CHECK (media_type IN ('image', 'video')),
  file_name text,
  file_size bigint, -- bytes
  sort_order integer NOT NULL DEFAULT 0, -- 用于排序
  has_watermark boolean NOT NULL DEFAULT false, -- 是否已添加水印（仅图片）
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

-- 创建索引
CREATE INDEX IF NOT EXISTS post_media_post_id_idx ON public.post_media(post_id);
CREATE INDEX IF NOT EXISTS post_media_sort_order_idx ON public.post_media(post_id, sort_order);

-- ============================================
-- 3. Enable RLS on post_media
-- ============================================

ALTER TABLE public.post_media ENABLE ROW LEVEL SECURITY;

-- SELECT: 与 posts 相同的可见性逻辑
DROP POLICY IF EXISTS "post_media_select_visible" ON public.post_media;
CREATE POLICY "post_media_select_visible"
  ON public.post_media
  FOR SELECT
  USING (
    -- 通过关联的 post 来判断可见性
    EXISTS (
      SELECT 1 FROM public.posts
      WHERE posts.id = post_media.post_id
        AND (
          -- Creator 本人永远可见
          posts.creator_id = auth.uid()
          OR
          -- Free posts 所有人可见
          posts.visibility = 'free'
          OR
          -- Subscribers-only: 需要 active subscription
          (posts.visibility = 'subscribers' AND EXISTS (
            SELECT 1 FROM public.subscriptions
            WHERE subscriber_id = auth.uid()
              AND creator_id = posts.creator_id
              AND status = 'active'
              AND ends_at > timezone('utc', now())
          ))
          OR
          -- PPV: 需要解锁
          (posts.visibility = 'ppv' AND EXISTS (
            SELECT 1 FROM public.post_unlocks
            WHERE user_id = auth.uid()
              AND post_id = posts.id
          ))
        )
    )
  );

-- INSERT: 只有 post 的 creator 可以添加 media
DROP POLICY IF EXISTS "post_media_insert_creator" ON public.post_media;
CREATE POLICY "post_media_insert_creator"
  ON public.post_media
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.posts
      WHERE posts.id = post_media.post_id
        AND posts.creator_id = auth.uid()
    )
  );

-- UPDATE: 只有 post 的 creator 可以更新 media
DROP POLICY IF EXISTS "post_media_update_creator" ON public.post_media;
CREATE POLICY "post_media_update_creator"
  ON public.post_media
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.posts
      WHERE posts.id = post_media.post_id
        AND posts.creator_id = auth.uid()
    )
  );

-- DELETE: 只有 post 的 creator 可以删除 media
DROP POLICY IF EXISTS "post_media_delete_creator" ON public.post_media;
CREATE POLICY "post_media_delete_creator"
  ON public.post_media
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.posts
      WHERE posts.id = post_media.post_id
        AND posts.creator_id = auth.uid()
    )
  );

-- ============================================
-- 4. Add preview_enabled column to posts
-- ============================================

ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS preview_enabled boolean NOT NULL DEFAULT false;

-- ============================================
-- 5. Verify schema
-- ============================================

-- Verify post_media table
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'post_media'
    ) THEN '✅ post_media 表存在'
    ELSE '❌ post_media 表不存在'
  END AS post_media_status;

-- Verify post_media columns
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'post_media'
ORDER BY ordinal_position;

-- Verify posts.preview_enabled
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'posts'
  AND column_name = 'preview_enabled';

-- Verify RLS policies
SELECT 
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'post_media'
ORDER BY policyname;



