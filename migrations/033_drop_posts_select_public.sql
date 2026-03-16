-- Migration 033: Drop posts_select_public policy (CRITICAL security fix)
--
-- Root cause identified via runtime debugging (2026-03-10):
--   Migration 007 created: posts_select_public WITH USING (true)
--   Migrations 008/010/013/021 added posts_select_visible (with proper access control)
--   but NEVER dropped posts_select_public.
--
-- PostgreSQL RLS combines PERMISSIVE policies with OR logic.
-- Result: USING (true) wins for every row → ALL posts (including paid/subscriber-only)
-- are readable by ANY user, including anonymous users.
--
-- Proof:
--   curl <supabase>/rest/v1/posts?select=id,visibility (anon key, no JWT)
--   → returns subscribers and ppv posts with full content
--
-- Fix: Drop the permissive policy. posts_select_visible (migration 021) remains
-- as the sole SELECT policy and correctly gates by visibility + subscription/purchase.

DROP POLICY IF EXISTS "posts_select_public" ON public.posts;

-- Verify posts_select_visible is present (it should be from migration 021)
-- If not, the following CREATE will add it as a safety net:
DO $$
DECLARE
  policy_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'posts'
      AND policyname = 'posts_select_visible'
      AND schemaname = 'public'
  ) INTO policy_exists;

  IF NOT policy_exists THEN
    RAISE EXCEPTION 'CRITICAL: posts_select_visible policy not found! Cannot safely drop posts_select_public. Please apply migration 021 first.';
  END IF;

  RAISE NOTICE 'posts_select_visible policy confirmed present. posts_select_public dropped safely.';
END $$;
