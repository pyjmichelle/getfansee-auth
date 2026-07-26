-- 046_alpha_discovery.sql
-- Pre-Payment Alpha: discovery & growth platform foundations.
--
-- Adds:
--   1. profiles.category + profiles.is_founding_creator
--   2. creator_external_links (submit -> admin review -> public display + click counting)
--   3. follows (free follow, separate from paid subscriptions)
--   4. saved_creators (bookmark creators; saved_posts already exists in 001)
--   5. newsletter_subscribers (email capture, double opt-in)
--   6. public_creator_profiles view rebuilt to expose category / is_founding_creator
--
-- All statements are idempotent.
--
-- NOTE: production has schema drift (some objects from 001/020 never applied),
-- so this migration re-declares its historical dependencies defensively:
-- set_updated_at(), saved_posts, tags/creator_tags. All are IF NOT EXISTS /
-- OR REPLACE and no-op on environments that already have them.

-- ============================================
-- 0. Dependency guard: set_updated_at() (from 001)
-- ============================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$;

-- ============================================
-- 1. profiles: category + founding creator flag
-- ============================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS category text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_founding_creator boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.category IS
  'Creator primary category (e.g. Fitness, Fashion). Shown on public profile and directory.';

COMMENT ON COLUMN public.profiles.is_founding_creator IS
  'True for creators KYC-verified during the Pre-Payment Alpha. Grants the Founding Creator '
  'badge and the Beta 0% commission window.';

-- Backfill: every already-verified creator at Alpha time is a Founding Creator.
UPDATE public.profiles
SET is_founding_creator = true
WHERE role = 'creator' AND is_verified = true AND is_founding_creator = false;

-- ============================================
-- 2. creator_external_links
-- ============================================

CREATE TABLE IF NOT EXISTS public.creator_external_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  url text NOT NULL,
  label text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  click_count bigint NOT NULL DEFAULT 0,
  rejection_reason text,
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT creator_external_links_status_check
    CHECK (status IN ('pending', 'approved', 'rejected')),
  CONSTRAINT creator_external_links_url_check
    CHECK (url ~* '^https://')
);

CREATE INDEX IF NOT EXISTS creator_external_links_creator_idx
  ON public.creator_external_links(creator_id);
CREATE INDEX IF NOT EXISTS creator_external_links_status_idx
  ON public.creator_external_links(status);

-- Max 5 links per creator enforced at API layer.

ALTER TABLE public.creator_external_links ENABLE ROW LEVEL SECURITY;

-- Public (anon + authenticated) can read approved links only.
DROP POLICY IF EXISTS creator_external_links_select_approved ON public.creator_external_links;
CREATE POLICY creator_external_links_select_approved
  ON public.creator_external_links
  FOR SELECT
  USING (status = 'approved' OR creator_id = auth.uid());

-- Creator can insert own links (always lands as pending).
DROP POLICY IF EXISTS creator_external_links_insert_own ON public.creator_external_links;
CREATE POLICY creator_external_links_insert_own
  ON public.creator_external_links
  FOR INSERT
  TO authenticated
  WITH CHECK (creator_id = auth.uid() AND status = 'pending');

-- Creator can delete own links.
DROP POLICY IF EXISTS creator_external_links_delete_own ON public.creator_external_links;
CREATE POLICY creator_external_links_delete_own
  ON public.creator_external_links
  FOR DELETE
  TO authenticated
  USING (creator_id = auth.uid());

-- Review transitions (approve/reject) happen via admin API using the service role.

DROP TRIGGER IF EXISTS set_creator_external_links_updated_at ON public.creator_external_links;
CREATE TRIGGER set_creator_external_links_updated_at
  BEFORE UPDATE ON public.creator_external_links
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.creator_external_links IS
  'Creator-submitted external links (OnlyFans, Instagram, ...). Admin-reviewed against a '
  'domain allowlist before public display. click_count incremented via /api/link/out.';

-- ============================================
-- 3. follows (free follow)
-- ============================================

CREATE TABLE IF NOT EXISTS public.follows (
  follower_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (follower_id, creator_id),
  CONSTRAINT follows_no_self CHECK (follower_id <> creator_id)
);

CREATE INDEX IF NOT EXISTS follows_creator_idx ON public.follows(creator_id);
CREATE INDEX IF NOT EXISTS follows_follower_idx ON public.follows(follower_id);

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

-- User sees own follows; creator sees own followers.
DROP POLICY IF EXISTS follows_select_own ON public.follows;
CREATE POLICY follows_select_own
  ON public.follows
  FOR SELECT
  TO authenticated
  USING (follower_id = auth.uid() OR creator_id = auth.uid());

DROP POLICY IF EXISTS follows_insert_own ON public.follows;
CREATE POLICY follows_insert_own
  ON public.follows
  FOR INSERT
  TO authenticated
  WITH CHECK (follower_id = auth.uid());

DROP POLICY IF EXISTS follows_delete_own ON public.follows;
CREATE POLICY follows_delete_own
  ON public.follows
  FOR DELETE
  TO authenticated
  USING (follower_id = auth.uid());

COMMENT ON TABLE public.follows IS
  'Free follow relationship (Alpha). Distinct from paid subscriptions. Also feeds the '
  'Founding Fan eligibility snapshot (>= 10 follows).';

-- ============================================
-- 4. saved_creators
-- ============================================

CREATE TABLE IF NOT EXISTS public.saved_creators (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (user_id, creator_id)
);

CREATE INDEX IF NOT EXISTS saved_creators_user_idx ON public.saved_creators(user_id);

ALTER TABLE public.saved_creators ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS saved_creators_select_own ON public.saved_creators;
CREATE POLICY saved_creators_select_own
  ON public.saved_creators
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS saved_creators_insert_own ON public.saved_creators;
CREATE POLICY saved_creators_insert_own
  ON public.saved_creators
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS saved_creators_delete_own ON public.saved_creators;
CREATE POLICY saved_creators_delete_own
  ON public.saved_creators
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- saved_posts: defined in 001 but missing on some environments (prod schema drift).
-- Create it here if absent, then ensure the full policy set (001 also lacked DELETE —
-- fans could save but never unsave).
CREATE TABLE IF NOT EXISTS public.saved_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fan_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (fan_id, post_id)
);

ALTER TABLE public.saved_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS saved_posts_select_own ON public.saved_posts;
CREATE POLICY saved_posts_select_own
  ON public.saved_posts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = fan_id);

DROP POLICY IF EXISTS saved_posts_insert_own ON public.saved_posts;
CREATE POLICY saved_posts_insert_own
  ON public.saved_posts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = fan_id);

DROP POLICY IF EXISTS saved_posts_delete_own ON public.saved_posts;
CREATE POLICY saved_posts_delete_own
  ON public.saved_posts
  FOR DELETE
  TO authenticated
  USING (auth.uid() = fan_id);

-- ============================================
-- 5. newsletter_subscribers (email capture)
-- ============================================

CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  token uuid NOT NULL DEFAULT gen_random_uuid(),
  source text,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  CONSTRAINT newsletter_subscribers_status_check
    CHECK (status IN ('pending', 'confirmed', 'unsubscribed'))
);

CREATE INDEX IF NOT EXISTS newsletter_subscribers_status_idx
  ON public.newsletter_subscribers(status);

-- RLS enabled with NO policies: all access goes through server API (service role).
-- Emails are PII and must never be readable from the client.
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.newsletter_subscribers IS
  'Email capture for Alpha (double opt-in via token). Server-only access; no RLS policies '
  'by design — anon/authenticated roles cannot touch this table directly.';

-- ============================================
-- 6. Rebuild public_creator_profiles view
--    (preserves 043 semantics; adds category + is_founding_creator)
-- ============================================

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
  is_founding_creator,
  category,
  created_at
FROM public.profiles
WHERE role = 'creator'
  AND NOT COALESCE(is_banned, false);

GRANT SELECT ON public.public_creator_profiles TO anon;
GRANT SELECT ON public.public_creator_profiles TO authenticated;

COMMENT ON VIEW public.public_creator_profiles IS
  'Public-safe creator profile projection. Exposes is_verified, is_founding_creator and '
  'category; never exposes creator_verifications rows, ID docs, or KYC details.';

-- ============================================
-- 7. tags / creator_tags: ensure they exist (from 020; prod drift guard),
--    then allow anon SELECT for public directory pages
-- ============================================

CREATE TABLE IF NOT EXISTS public.tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  slug text UNIQUE NOT NULL,
  category text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT tags_category_check CHECK (category IN ('content', 'creator'))
);

CREATE INDEX IF NOT EXISTS tags_category_idx ON public.tags(category);
CREATE INDEX IF NOT EXISTS tags_slug_idx ON public.tags(slug);

CREATE TABLE IF NOT EXISTS public.creator_tags (
  creator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (creator_id, tag_id)
);

CREATE INDEX IF NOT EXISTS creator_tags_creator_id_idx ON public.creator_tags(creator_id);
CREATE INDEX IF NOT EXISTS creator_tags_tag_id_idx ON public.creator_tags(tag_id);

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_tags ENABLE ROW LEVEL SECURITY;

-- Base policies from 020 (no-ops where already present).
DROP POLICY IF EXISTS tags_select_all ON public.tags;
CREATE POLICY tags_select_all
  ON public.tags
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS creator_tags_select_all ON public.creator_tags;
CREATE POLICY creator_tags_select_all
  ON public.creator_tags
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS creator_tags_insert_own ON public.creator_tags;
CREATE POLICY creator_tags_insert_own
  ON public.creator_tags
  FOR INSERT
  TO authenticated
  WITH CHECK (creator_id = auth.uid());

DROP POLICY IF EXISTS creator_tags_delete_own ON public.creator_tags;
CREATE POLICY creator_tags_delete_own
  ON public.creator_tags
  FOR DELETE
  TO authenticated
  USING (creator_id = auth.uid());

-- Seed creator-category tags (from 020; no-op if already seeded).
INSERT INTO public.tags (name, slug, category, description) VALUES
  ('Photography', 'photography', 'creator', 'Photography and visual arts'),
  ('Fitness', 'fitness', 'creator', 'Fitness and health content'),
  ('Fashion', 'fashion', 'creator', 'Fashion and style content'),
  ('Gaming', 'gaming', 'creator', 'Gaming and esports content'),
  ('Music', 'music', 'creator', 'Music and audio content'),
  ('Art', 'art', 'creator', 'Art and creative content'),
  ('Lifestyle', 'lifestyle', 'creator', 'Lifestyle and daily content'),
  ('Adult', 'adult', 'creator', 'Adult content (18+)')
ON CONFLICT (name) DO NOTHING;

DROP POLICY IF EXISTS tags_select_anon ON public.tags;
CREATE POLICY tags_select_anon
  ON public.tags
  FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS creator_tags_select_anon ON public.creator_tags;
CREATE POLICY creator_tags_select_anon
  ON public.creator_tags
  FOR SELECT
  TO anon
  USING (true);

-- ============================================
-- 8. Verification
-- ============================================

DO $$
DECLARE
  v_links boolean;
  v_follows boolean;
  v_saved boolean;
  v_news boolean;
  v_category boolean;
  v_founding boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'creator_external_links') INTO v_links;
  SELECT EXISTS (SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'follows') INTO v_follows;
  SELECT EXISTS (SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'saved_creators') INTO v_saved;
  SELECT EXISTS (SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'newsletter_subscribers') INTO v_news;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles'
      AND column_name = 'category') INTO v_category;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles'
      AND column_name = 'is_founding_creator') INTO v_founding;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration 046 Verification:';
  RAISE NOTICE 'creator_external_links: %', v_links;
  RAISE NOTICE 'follows: %', v_follows;
  RAISE NOTICE 'saved_creators: %', v_saved;
  RAISE NOTICE 'newsletter_subscribers: %', v_news;
  RAISE NOTICE 'profiles.category: %', v_category;
  RAISE NOTICE 'profiles.is_founding_creator: %', v_founding;
  RAISE NOTICE '========================================';
END $$;
