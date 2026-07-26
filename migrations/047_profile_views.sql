-- Migration 047: Profile view tracking (Pre-Payment Alpha analytics)
--
-- Adds:
--   1. creator_daily_stats — per-day aggregate counters (profile views for now)
--   2. increment_profile_view() — atomic upsert increment (service role only)
--
-- Design notes:
-- - Aggregates only: no per-viewer rows, no PII, no fingerprinting.
-- - Writes happen exclusively through the server (service role) via
--   /api/creators/[id]/view; anon/authenticated roles cannot write.
-- - Creators can SELECT their own rows for the studio analytics page.
--
-- All statements are idempotent.

-- ============================================
-- 1. creator_daily_stats
-- ============================================

CREATE TABLE IF NOT EXISTS public.creator_daily_stats (
  creator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  day date NOT NULL DEFAULT (timezone('utc', now()))::date,
  profile_views integer NOT NULL DEFAULT 0,
  PRIMARY KEY (creator_id, day)
);

CREATE INDEX IF NOT EXISTS creator_daily_stats_day_idx ON public.creator_daily_stats(day);

ALTER TABLE public.creator_daily_stats ENABLE ROW LEVEL SECURITY;

-- Creators read their own analytics; nobody writes directly (server-only).
DROP POLICY IF EXISTS creator_daily_stats_select_own ON public.creator_daily_stats;
CREATE POLICY creator_daily_stats_select_own
  ON public.creator_daily_stats
  FOR SELECT
  TO authenticated
  USING (creator_id = auth.uid());

COMMENT ON TABLE public.creator_daily_stats IS
  'Per-day aggregate counters for creator analytics (Alpha: profile views). '
  'Server-only writes via increment_profile_view(); creators can read own rows.';

-- ============================================
-- 2. Atomic increment function (service role only)
-- ============================================

CREATE OR REPLACE FUNCTION public.increment_profile_view(p_creator_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.creator_daily_stats (creator_id, day, profile_views)
  VALUES (p_creator_id, (timezone('utc', now()))::date, 1)
  ON CONFLICT (creator_id, day)
  DO UPDATE SET profile_views = public.creator_daily_stats.profile_views + 1;
$$;

REVOKE ALL ON FUNCTION public.increment_profile_view(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_profile_view(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.increment_profile_view(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.increment_profile_view(uuid) TO service_role;

COMMENT ON FUNCTION public.increment_profile_view(uuid) IS
  'Atomically increments today''s profile view counter for a creator. '
  'Service role only — called from /api/creators/[id]/view.';

-- ============================================
-- 3. Verification
-- ============================================

DO $$
BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'creator_daily_stats'
  ), 'creator_daily_stats table missing';
  ASSERT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'increment_profile_view'
  ), 'increment_profile_view function missing';
END $$;
