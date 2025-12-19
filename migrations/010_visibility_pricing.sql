-- 010_visibility_pricing.sql
-- Phase 1.5: Visibility 和 Pricing 统一
-- Execute this in Supabase Dashboard SQL Editor

-- ============================================
-- 1. Add visibility column (if not exists)
-- ============================================

ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'free';

-- ============================================
-- 2. Add price_cents column (if not exists)
-- ============================================

ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS price_cents integer NULL;

-- ============================================
-- 3. Backfill existing data
-- ============================================

-- 将现有的 is_locked=false 设置为 visibility='free'
UPDATE public.posts 
SET visibility = 'free'
WHERE visibility = 'free' OR (visibility IS NULL AND is_locked = false);

-- 将现有的 is_locked=true 设置为 visibility='subscribers'（保守处理）
UPDATE public.posts 
SET visibility = 'subscribers'
WHERE visibility != 'free' AND (visibility IS NULL OR visibility = '') AND is_locked = true;

-- 确保所有行都有 visibility
UPDATE public.posts 
SET visibility = 'free'
WHERE visibility IS NULL OR visibility = '';

-- ============================================
-- 4. Add check constraint for visibility
-- ============================================

-- 删除旧约束（如果存在）
ALTER TABLE public.posts 
DROP CONSTRAINT IF EXISTS posts_visibility_check;

-- 添加新约束：visibility 必须是 'free' | 'subscribers' | 'ppv'
ALTER TABLE public.posts 
ADD CONSTRAINT posts_visibility_check 
CHECK (visibility IN ('free', 'subscribers', 'ppv'));

-- ============================================
-- 5. Add check constraint for price_cents
-- ============================================

-- 删除旧约束（如果存在）
ALTER TABLE public.posts 
DROP CONSTRAINT IF EXISTS posts_price_cents_check;

-- 添加新约束：
-- - visibility='ppv' 时，price_cents 必须 > 0
-- - visibility != 'ppv' 时，price_cents 必须为 NULL
ALTER TABLE public.posts 
ADD CONSTRAINT posts_price_cents_check 
CHECK (
  (visibility = 'ppv' AND price_cents IS NOT NULL AND price_cents > 0)
  OR
  (visibility != 'ppv' AND price_cents IS NULL)
);

-- ============================================
-- 6. Update RLS policy for posts visibility
-- ============================================

-- 删除旧的 posts_select_visible policy
DROP POLICY IF EXISTS "posts_select_visible" ON public.posts;

-- 创建新的 RLS policy，支持 visibility 逻辑：
-- - free: 所有人可见
-- - subscribers: creator 本人 OR 已订阅（active subscription）
-- - ppv: creator 本人 OR 已解锁（post_unlocks）
CREATE POLICY "posts_select_visible"
  ON public.posts
  FOR SELECT
  USING (
    -- Creator 本人永远可见
    creator_id = auth.uid()
    OR
    -- Free posts 所有人可见
    visibility = 'free'
    OR
    -- Subscribers-only: 需要 active subscription
    (visibility = 'subscribers' AND EXISTS (
      SELECT 1 FROM public.subscriptions
      WHERE subscriber_id = auth.uid()
        AND creator_id = posts.creator_id
        AND status = 'active'
        AND ends_at > timezone('utc', now())
    ))
    OR
    -- PPV: 需要解锁（订阅不覆盖 PPV）
    (visibility = 'ppv' AND EXISTS (
      SELECT 1 FROM public.post_unlocks
      WHERE user_id = auth.uid()
        AND post_id = posts.id
    ))
  );

-- ============================================
-- 7. Verify schema
-- ============================================

-- 验证 visibility 列
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'posts'
  AND column_name IN ('visibility', 'price_cents')
ORDER BY column_name;

-- 验证 constraints
SELECT 
  tc.constraint_name,
  tc.constraint_type,
  cc.check_clause
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.check_constraints cc 
  ON tc.constraint_name = cc.constraint_name
WHERE tc.table_schema = 'public' 
  AND tc.table_name = 'posts'
  AND tc.constraint_type = 'CHECK'
ORDER BY tc.constraint_name;

-- 验证 RLS policies
SELECT 
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'posts'
  AND policyname = 'posts_select_visible';
