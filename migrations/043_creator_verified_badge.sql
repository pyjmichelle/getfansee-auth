-- Migration 043: Creator verified badge
-- Goals:
-- 1) Add is_verified boolean column to profiles (denormalized from creator_verifications)
-- 2) Backfill is_verified from existing approved KYC records
-- 3) Rebuild public_creator_profiles view to expose is_verified (security_barrier preserved)
--
-- is_verified = true when creator_verifications.status = 'approved' OR
--               legacy: role = 'creator' AND age_verified = true
--
-- This column is the single public signal for the verified badge UI.
-- It NEVER exposes creator_verifications rows, ID docs, country, or any KYC detail.

-- --------------------------------------------
-- 1. Add is_verified column (idempotent)
-- --------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false;

-- --------------------------------------------
-- 2. Backfill from creator_verifications
-- --------------------------------------------
UPDATE public.profiles p
SET is_verified = true
WHERE
  -- KYC approved (primary source of truth)
  EXISTS (
    SELECT 1 FROM public.creator_verifications cv
    WHERE cv.user_id = p.id
      AND cv.status = 'approved'
  )
  OR
  -- Legacy fallback: creator role + age_verified (for records before KYC table existed)
  (p.role = 'creator' AND COALESCE(p.age_verified, false) = true);

-- --------------------------------------------
-- 3. Rebuild public_creator_profiles view with is_verified
--    Preserves security_barrier = true and existing grants from migration 031.
-- --------------------------------------------
DROP VIEW IF EXISTS public.public_creator_profiles;

CREATE VIEW public.public_creator_profiles
  WITH (security_barrier = true)
AS
SELECT
  id,
  display_name,
  avatar_url,
  bio,
  role,
  blocked_countries,
  is_verified,
  created_at
FROM public.profiles
WHERE role = 'creator'
  AND NOT COALESCE(is_banned, false);

-- Re-grant SELECT (dropped with the view)
GRANT SELECT ON public.public_creator_profiles TO anon;
GRANT SELECT ON public.public_creator_profiles TO authenticated;

COMMENT ON VIEW public.public_creator_profiles IS
  'Public-safe creator profile projection. Exposes is_verified boolean only; '
  'never exposes creator_verifications rows, ID docs, or KYC details.';

COMMENT ON COLUMN public.profiles.is_verified IS
  'Denormalized: true when creator_verifications.status = approved. '
  'Written by kyc-service on KYC approval. Used for the verified badge UI only.';

-- --------------------------------------------
-- 4. Index for fast is_verified lookups on feed/search
-- --------------------------------------------
CREATE INDEX IF NOT EXISTS idx_profiles_is_verified
  ON public.profiles(is_verified)
  WHERE is_verified = true;

-- --------------------------------------------
-- 5. Verification
-- --------------------------------------------
DO $$
DECLARE
  v_column_exists boolean;
  v_view_exists   boolean;
  v_verified_count bigint;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'profiles'
      AND column_name  = 'is_verified'
  ) INTO v_column_exists;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_schema = 'public'
      AND table_name   = 'public_creator_profiles'
  ) INTO v_view_exists;

  SELECT COUNT(*) FROM public.profiles WHERE is_verified = true
  INTO v_verified_count;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration 043 Verification:';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'profiles.is_verified column exists: %', v_column_exists;
  RAISE NOTICE 'public_creator_profiles view exists: %', v_view_exists;
  RAISE NOTICE 'Profiles backfilled as verified: %',     v_verified_count;
  RAISE NOTICE '========================================';
END $$;
