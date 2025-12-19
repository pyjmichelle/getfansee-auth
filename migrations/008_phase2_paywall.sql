-- 008_phase2_paywall.sql
-- Phase 2: Paywall 最小闭环
-- Execute this in Supabase Dashboard SQL Editor

-- ============================================
-- 1. Ensure posts table has is_locked field
-- ============================================

ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false;

-- ============================================
-- 2. Migrate subscriptions table (if exists with old schema)
-- ============================================

-- 检查是否存在旧的 subscriptions 表（使用 user_id）
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'subscriptions' 
      AND column_name = 'user_id'
  ) THEN
    -- 删除旧的 subscriptions 表（先删除依赖的 policies）
    DROP POLICY IF EXISTS "subscriptions_select_own" ON public.subscriptions;
    DROP POLICY IF EXISTS "subscriptions_insert_own" ON public.subscriptions;
    DROP POLICY IF EXISTS "subscriptions_update_own" ON public.subscriptions;
    DROP POLICY IF EXISTS "subscriptions_delete_own" ON public.subscriptions;
    DROP TRIGGER IF EXISTS set_subscriptions_updated_at ON public.subscriptions;
    DROP TABLE IF EXISTS public.subscriptions CASCADE;
  END IF;
END $$;

-- 创建新的 subscriptions 表（使用 subscriber_id 和 creator_id）
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled')),
  starts_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  ends_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE(subscriber_id, creator_id) -- 每个 fan 对每个 creator 只能有一条 subscription
);

-- ============================================
-- 3. Migrate post_unlocks table (if exists with old schema)
-- ============================================

-- 检查 post_unlocks 表是否存在，如果 post_id 是 text 类型，需要重建
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'post_unlocks' 
      AND column_name = 'post_id'
      AND data_type = 'text'
  ) THEN
    -- 删除旧的 post_unlocks 表（先删除依赖的 policies）
    DROP POLICY IF EXISTS "post_unlocks_select_own" ON public.post_unlocks;
    DROP POLICY IF EXISTS "post_unlocks_insert_own" ON public.post_unlocks;
    DROP POLICY IF EXISTS "post_unlocks_delete_own" ON public.post_unlocks;
    DROP TABLE IF EXISTS public.post_unlocks CASCADE;
  END IF;
END $$;

-- 创建新的 post_unlocks 表（post_id 使用 uuid，引用 posts.id）
CREATE TABLE IF NOT EXISTS public.post_unlocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE(user_id, post_id) -- 每个用户对每个 post 只能解锁一次
);

-- ============================================
-- 4. Enable RLS
-- ============================================

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_unlocks ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. subscriptions RLS policies
-- ============================================

-- SELECT: 用户只能查询自己的 subscriptions
DROP POLICY IF EXISTS "subscriptions_select_own" ON public.subscriptions;
CREATE POLICY "subscriptions_select_own"
  ON public.subscriptions
  FOR SELECT
  USING (auth.uid() = subscriber_id);

-- INSERT: 用户只能插入自己的 subscription
DROP POLICY IF EXISTS "subscriptions_insert_own" ON public.subscriptions;
CREATE POLICY "subscriptions_insert_own"
  ON public.subscriptions
  FOR INSERT
  WITH CHECK (auth.uid() = subscriber_id);

-- UPDATE: 用户只能更新自己的 subscription
DROP POLICY IF EXISTS "subscriptions_update_own" ON public.subscriptions;
CREATE POLICY "subscriptions_update_own"
  ON public.subscriptions
  FOR UPDATE
  USING (auth.uid() = subscriber_id)
  WITH CHECK (auth.uid() = subscriber_id);

-- DELETE: 用户只能删除自己的 subscription
DROP POLICY IF EXISTS "subscriptions_delete_own" ON public.subscriptions;
CREATE POLICY "subscriptions_delete_own"
  ON public.subscriptions
  FOR DELETE
  USING (auth.uid() = subscriber_id);

-- ============================================
-- 6. post_unlocks RLS policies
-- ============================================

-- SELECT: 用户只能查询自己的 unlocks
DROP POLICY IF EXISTS "post_unlocks_select_own" ON public.post_unlocks;
CREATE POLICY "post_unlocks_select_own"
  ON public.post_unlocks
  FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT: 用户只能插入自己的 unlock
DROP POLICY IF EXISTS "post_unlocks_insert_own" ON public.post_unlocks;
CREATE POLICY "post_unlocks_insert_own"
  ON public.post_unlocks
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- DELETE: 用户只能删除自己的 unlock
DROP POLICY IF EXISTS "post_unlocks_delete_own" ON public.post_unlocks;
CREATE POLICY "post_unlocks_delete_own"
  ON public.post_unlocks
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- 7. posts RLS policy for locked content
-- ============================================

-- 确保 posts 表 RLS 已启用
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- 删除旧的 posts_select_visible policy（如果存在）
DROP POLICY IF EXISTS "posts_select_visible" ON public.posts;

-- SELECT: 公开 posts 或 locked posts（仅 creator 本人、已订阅、已解锁的用户可见）
CREATE POLICY "posts_select_visible"
  ON public.posts
  FOR SELECT
  USING (
    -- 公开 post（is_locked = false）
    is_locked = false
    OR
    -- creator 本人
    creator_id = auth.uid()
    OR
    -- 已订阅（active subscription 且未过期）
    EXISTS (
      SELECT 1 FROM public.subscriptions
      WHERE subscriber_id = auth.uid()
        AND creator_id = posts.creator_id
        AND status = 'active'
        AND ends_at > timezone('utc', now())
    )
    OR
    -- 已解锁（post_unlocks 中有记录）
    EXISTS (
      SELECT 1 FROM public.post_unlocks
      WHERE user_id = auth.uid()
        AND post_id = posts.id
    )
  );

-- INSERT/UPDATE/DELETE: 保持原有策略（仅 creator 本人）
-- 这些策略应该在 007_phase1_posts.sql 中已创建，这里不重复创建

-- ============================================
-- 8. Verify tables and fields
-- ============================================

-- Verify posts.is_locked
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'posts'
  AND column_name = 'is_locked';

-- Verify subscriptions table
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'subscriptions'
    ) THEN '✅ subscriptions 表存在'
    ELSE '❌ subscriptions 表不存在'
  END AS subscriptions_status;

-- Verify subscriptions table columns
SELECT 
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'subscriptions'
ORDER BY ordinal_position;

-- Verify post_unlocks table
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'post_unlocks'
    ) THEN '✅ post_unlocks 表存在'
    ELSE '❌ post_unlocks 表不存在'
  END AS post_unlocks_status;

-- Verify post_unlocks table columns
SELECT 
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'post_unlocks'
ORDER BY ordinal_position;

-- Verify RLS policies
SELECT 
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename IN ('subscriptions', 'post_unlocks', 'posts')
ORDER BY tablename, policyname;

