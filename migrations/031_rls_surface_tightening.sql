-- Migration 031: RLS surface tightening (public profile reads via safe view)
-- Goals:
-- 1) Route public creator reads through a least-privilege view
-- 2) Reduce accidental direct reads from profiles by anon role
-- 3) Keep compatibility for authenticated self-profile operations

-- Ensure profiles RLS is enabled
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;

-- Keep authenticated policy compatible with existing app behavior.
DROP POLICY IF EXISTS "profiles_select_self_or_creator" ON public.profiles;
CREATE POLICY "profiles_select_self_or_creator"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id
    OR (role = 'creator' AND NOT COALESCE(is_banned, false))
  );

-- Explicitly prevent anon from direct table reads.
DROP POLICY IF EXISTS "profiles_select_public_anon" ON public.profiles;
CREATE POLICY "profiles_select_public_anon"
  ON public.profiles
  FOR SELECT
  TO anon
  USING (false);

-- Rebuild safe public creator view (security barrier).
DROP VIEW IF EXISTS public.public_creator_profiles;
CREATE VIEW public.public_creator_profiles WITH (security_barrier = true) AS
SELECT
  id,
  display_name,
  avatar_url,
  bio,
  role,
  blocked_countries,
  created_at
FROM public.profiles
WHERE role = 'creator'
  AND NOT COALESCE(is_banned, false);

GRANT SELECT ON public.public_creator_profiles TO anon;
GRANT SELECT ON public.public_creator_profiles TO authenticated;

COMMENT ON VIEW public.public_creator_profiles IS
  'Public-safe creator profile projection (no email/username/private fields).';
