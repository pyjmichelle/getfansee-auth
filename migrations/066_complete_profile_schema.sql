-- Generated with Supabase CLI; retained in the repository's numbered stream.
-- Reconcile fields previously configured manually but missing from migrations.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subscription_price_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.profiles
  ALTER COLUMN subscription_price_cents SET DEFAULT 0,
  ALTER COLUMN subscription_price_cents SET NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.profiles'::regclass
                 AND conname='profiles_subscription_price_cents_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_subscription_price_cents_check
      CHECK (subscription_price_cents >= 0);
  END IF;
END; $$;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('fan', 'creator', 'admin'));

-- Keep the existing safe projection/filter and append the public handle last.
-- Browser promotion remains forbidden by the privileged-field trigger in 062.
CREATE OR REPLACE VIEW public.public_creator_profiles
  WITH (security_barrier = true)
AS SELECT id, display_name, avatar_url, bio, role, blocked_countries, is_verified,
          is_founding_creator, category, created_at, username
   FROM public.profiles
   WHERE role = 'creator' AND NOT COALESCE(is_banned, false);
GRANT SELECT ON public.public_creator_profiles TO anon, authenticated;
