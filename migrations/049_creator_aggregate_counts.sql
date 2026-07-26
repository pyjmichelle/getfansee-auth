-- Migration 049: DB-side aggregate counts for creator directory
--
-- Fixes an unbounded-query pattern found in the 2026-07-26 UI/performance
-- audit of app/api/creators/directory/route.ts: for every page of up to
-- MAX_RESULTS*2 (120) creators, the route ran
--   admin.from("follows").select("creator_id").in("creator_id", creatorIds)
--   admin.from("posts").select("creator_id").in("creator_id", creatorIds)
-- and counted rows in JavaScript. This downloads every follow/post row ever
-- created for every listed creator just to compute a number — for a
-- popular creator with tens of thousands of followers, one directory page
-- view pulls tens of thousands of rows across the wire.
--
-- Fix: a single SECURITY DEFINER function that does the counting with
-- `GROUP BY` inside Postgres and returns only one row per creator. The
-- route calls this via `.rpc()` and falls back to the old (still capped)
-- in-memory approach if the migration has not been applied yet, matching
-- the existing degrade-gracefully convention used for migration 047's
-- `increment_profile_view`.

CREATE OR REPLACE FUNCTION public.get_creator_directory_counts(p_creator_ids uuid[])
RETURNS TABLE (creator_id uuid, follower_count bigint, post_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ids.id AS creator_id,
    COALESCE(f.cnt, 0) AS follower_count,
    COALESCE(p.cnt, 0) AS post_count
  FROM unnest(p_creator_ids) AS ids(id)
  LEFT JOIN (
    SELECT creator_id, count(*) AS cnt
    FROM public.follows
    WHERE creator_id = ANY(p_creator_ids)
    GROUP BY creator_id
  ) f ON f.creator_id = ids.id
  LEFT JOIN (
    SELECT creator_id, count(*) AS cnt
    FROM public.posts
    WHERE creator_id = ANY(p_creator_ids)
    GROUP BY creator_id
  ) p ON p.creator_id = ids.id;
$$;

COMMENT ON FUNCTION public.get_creator_directory_counts(uuid[]) IS
  'Batch follower/post counts for the creator directory. Runs GROUP BY in Postgres instead of pulling every follow/post row to the app for JS counting.';

-- Service-role only (called from the admin client in the directory route).
REVOKE ALL ON FUNCTION public.get_creator_directory_counts(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_creator_directory_counts(uuid[]) TO service_role;
