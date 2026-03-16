-- Migration 032: Fix RLS infinite recursion between posts and purchases tables
-- 
-- Root cause identified via runtime debugging (2026-03-10):
--   1. posts_select_visible policy (migration 021) queries public.purchases
--      to check PPV unlock status.
--   2. purchases_select_self_or_creator policy (migration 025) queries
--      public.posts to let creators see purchases on their posts.
--   3. Circular reference: posts → purchases → posts → ...
--      PostgreSQL throws: "infinite recursion detected in policy for relation posts" (code 42P17)
--
-- Fix: Remove the posts subquery from the purchases policy.
-- Creator earnings/stats are served entirely via SECURITY DEFINER functions
-- (unlock_ppv, recharge_wallet) and the transactions table, so creators do not
-- need direct RLS-level access to purchases via a posts join.

DROP POLICY IF EXISTS "purchases_select_self_or_creator" ON public.purchases;

CREATE POLICY "purchases_select_self_or_creator"
  ON public.purchases
  FOR SELECT
  TO authenticated
  USING (
    -- Fan can see their own purchases.
    -- Creator access is served via SECURITY DEFINER RPCs (unlock_ppv, paywall earnings).
    auth.uid() = fan_id
  );

COMMENT ON POLICY "purchases_select_self_or_creator" ON public.purchases IS
  'Migration 032: removed posts subquery to break posts↔purchases RLS infinite recursion.';
