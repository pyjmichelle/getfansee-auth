-- 012_watermark_final.sql
-- Phase 2: 最终水印实现（可选，左上角，仅图片）
-- Execute this in Supabase Dashboard SQL Editor

-- ============================================
-- 1. Add watermark_enabled to posts table
-- ============================================

ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS watermark_enabled boolean NOT NULL DEFAULT true;

-- ============================================
-- 2. Update post_media table: add watermarked_path
-- ============================================

ALTER TABLE public.post_media 
ADD COLUMN IF NOT EXISTS watermarked_path text NULL;

-- Remove old has_watermark column (replaced by watermarked_path)
ALTER TABLE public.post_media 
DROP COLUMN IF EXISTS has_watermark;

-- ============================================
-- 3. Verify schema
-- ============================================

-- Verify posts.watermark_enabled
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'posts'
  AND column_name = 'watermark_enabled';

-- Verify post_media.watermarked_path
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'post_media'
  AND column_name = 'watermarked_path';

-- Verify has_watermark is removed
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' 
        AND table_name = 'post_media'
        AND column_name = 'has_watermark'
    ) THEN '❌ has_watermark 列仍存在（需要手动删除）'
    ELSE '✅ has_watermark 列已删除'
  END AS has_watermark_status;



