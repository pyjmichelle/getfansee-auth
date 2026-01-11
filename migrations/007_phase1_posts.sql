-- 007_phase1_posts.sql
-- Phase 1: Creator Profile + Posts + Feed
-- Execute this in Supabase Dashboard SQL Editor

-- ============================================
-- 1. Ensure profiles table has all required fields
-- ============================================

-- Add bio if not exists
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS bio text;

-- Add avatar_url if not exists
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS avatar_url text;

-- Ensure role has CHECK constraint
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'profiles_role_check'
  ) THEN
    ALTER TABLE public.profiles 
    ADD CONSTRAINT profiles_role_check CHECK (role IN ('fan', 'creator'));
  END IF;
END $$;

-- Ensure updated_at trigger function exists
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure updated_at trigger exists on profiles
DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- 2. Create posts table
-- ============================================

CREATE TABLE IF NOT EXISTS public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text,
  content text NOT NULL,
  media_url text,
  is_locked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

-- ============================================
-- 3. Enable RLS on posts
-- ============================================

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 4. posts RLS policies
-- ============================================

-- SELECT: Anyone can read posts (Phase 1: all public)
DROP POLICY IF EXISTS "posts_select_public" ON public.posts;
CREATE POLICY "posts_select_public"
  ON public.posts
  FOR SELECT
  USING (true);

-- INSERT: Only creators can insert their own posts
DROP POLICY IF EXISTS "posts_insert_own" ON public.posts;
CREATE POLICY "posts_insert_own"
  ON public.posts
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'creator'
    )
    AND creator_id = auth.uid()
  );

-- UPDATE: Only creators can update their own posts
DROP POLICY IF EXISTS "posts_update_own" ON public.posts;
CREATE POLICY "posts_update_own"
  ON public.posts
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'creator'
    )
    AND creator_id = auth.uid()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'creator'
    )
    AND creator_id = auth.uid()
  );

-- DELETE: Only creators can delete their own posts
DROP POLICY IF EXISTS "posts_delete_own" ON public.posts;
CREATE POLICY "posts_delete_own"
  ON public.posts
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'creator'
    )
    AND creator_id = auth.uid()
  );

-- ============================================
-- 5. Verify tables and fields
-- ============================================

-- Verify profiles fields
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'profiles'
  AND column_name IN ('id', 'email', 'display_name', 'role', 'age_verified', 'bio', 'avatar_url', 'created_at', 'updated_at')
ORDER BY column_name;

-- Verify posts table exists
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'posts'
    ) THEN '✅ posts 表创建成功'
    ELSE '❌ posts 表创建失败'
  END AS posts_status;

-- Verify posts fields
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'posts'
ORDER BY ordinal_position;

-- Verify RLS policies
SELECT 
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'posts'
ORDER BY policyname;



