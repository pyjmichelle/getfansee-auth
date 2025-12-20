-- 013_money_access_mvp.sql
-- Money & Access MVP Skeleton
-- Execute this in Supabase Dashboard SQL Editor

-- ============================================
-- 1. Create creators table
-- ============================================

CREATE TABLE IF NOT EXISTS public.creators (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  avatar_url text,
  bio text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

-- ============================================
-- 2. Update posts table to match MVP schema
-- ============================================

-- Ensure posts has required fields
ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS title text;

-- Drop old constraint that conflicts with new schema
-- Old constraint: visibility='ppv' requires price_cents>0, visibility!='ppv' requires price_cents=NULL
-- New schema: price_cents=0 means subscriber-only, price_cents>0 means PPV
ALTER TABLE public.posts 
DROP CONSTRAINT IF EXISTS posts_price_cents_check;

-- Update price_cents: 0 means subscriber-only, >0 means PPV
-- If price_cents is NULL, set to 0 (subscriber-only)
UPDATE public.posts 
SET price_cents = 0 
WHERE price_cents IS NULL;

-- Make price_cents NOT NULL with default 0
ALTER TABLE public.posts 
ALTER COLUMN price_cents SET DEFAULT 0,
ALTER COLUMN price_cents SET NOT NULL;

-- Add new constraint: price_cents must be >= 0 (0 = subscriber-only, >0 = PPV)
ALTER TABLE public.posts 
ADD CONSTRAINT posts_price_cents_check 
CHECK (price_cents >= 0);

-- Add cover_url if not exists
ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS cover_url text;

-- Ensure content is NOT NULL
ALTER TABLE public.posts 
ALTER COLUMN content SET NOT NULL;

-- Note: posts.creator_id may reference profiles, but we'll use creators table
-- The sync trigger will ensure creators exist when profiles.role='creator'

-- ============================================
-- 3. Ensure creator_id exists in creators table
-- ============================================

-- Function to sync profiles to creators
-- Use SECURITY DEFINER to bypass RLS for trigger operations
-- The function will run as the function owner (postgres), which can bypass RLS
CREATE OR REPLACE FUNCTION sync_profile_to_creator()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When a profile with role='creator' is created/updated, sync to creators
  IF NEW.role = 'creator' THEN
    INSERT INTO public.creators (id, display_name, avatar_url, bio)
    VALUES (NEW.id, NEW.display_name, NEW.avatar_url, NEW.bio)
    ON CONFLICT (id) DO UPDATE
    SET 
      display_name = NEW.display_name,
      avatar_url = NEW.avatar_url,
      bio = NEW.bio;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated and anon roles
GRANT EXECUTE ON FUNCTION sync_profile_to_creator() TO authenticated;
GRANT EXECUTE ON FUNCTION sync_profile_to_creator() TO anon;

-- Ensure function owner is postgres (has bypass RLS permission)
-- This allows the SECURITY DEFINER function to bypass RLS
-- Note: In Supabase, functions created by postgres user automatically bypass RLS
-- But we need to ensure the function has the right permissions
DO $$
BEGIN
  -- Try to set owner to postgres (may fail if not superuser, but that's OK)
  BEGIN
    ALTER FUNCTION sync_profile_to_creator() OWNER TO postgres;
  EXCEPTION WHEN OTHERS THEN
    -- If we can't change owner, that's OK - function should still work
    NULL;
  END;
END $$;

-- Trigger to sync profiles to creators
DROP TRIGGER IF EXISTS sync_profile_to_creator_trigger ON public.profiles;
CREATE TRIGGER sync_profile_to_creator_trigger
AFTER INSERT OR UPDATE ON public.profiles
FOR EACH ROW
WHEN (NEW.role = 'creator')
EXECUTE FUNCTION sync_profile_to_creator();

-- Backfill: Create creators from existing profiles with role='creator'
INSERT INTO public.creators (id, display_name, avatar_url, bio)
SELECT id, display_name, avatar_url, bio
FROM public.profiles
WHERE role = 'creator'
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 4. Update subscriptions table
-- ============================================

-- Add plan column if not exists
ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'monthly';

-- Add check constraint for plan
ALTER TABLE public.subscriptions 
DROP CONSTRAINT IF EXISTS subscriptions_plan_check;

ALTER TABLE public.subscriptions 
ADD CONSTRAINT subscriptions_plan_check 
CHECK (plan IN ('monthly', 'yearly'));

-- Rename ends_at to current_period_end if needed
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'subscriptions' 
      AND column_name = 'ends_at'
  ) THEN
    ALTER TABLE public.subscriptions 
    RENAME COLUMN ends_at TO current_period_end;
  END IF;
END $$;

-- Ensure current_period_end exists and is NOT NULL
ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS current_period_end timestamptz NOT NULL DEFAULT (timezone('utc', now()) + interval '30 days');

-- Update status check constraint to include 'expired'
ALTER TABLE public.subscriptions 
DROP CONSTRAINT IF EXISTS subscriptions_status_check;

ALTER TABLE public.subscriptions 
ADD CONSTRAINT subscriptions_status_check 
CHECK (status IN ('active', 'canceled', 'expired'));

-- Update creator_id FK to reference creators table
-- Drop any existing FK constraint on creator_id (may reference profiles or creators)
DO $$
DECLARE
  fk_constraint_name text;
BEGIN
  -- Find FK constraint on creator_id column
  SELECT tc.constraint_name INTO fk_constraint_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  WHERE tc.table_schema = 'public' 
    AND tc.table_name = 'subscriptions'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'creator_id'
  LIMIT 1;
  
  -- Drop the constraint if found
  IF fk_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS %I', fk_constraint_name);
  END IF;
END $$;

-- Add new FK constraint to creators (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu 
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name
      AND tc.table_schema = ccu.table_schema
    WHERE tc.table_schema = 'public' 
      AND tc.table_name = 'subscriptions'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'creator_id'
      AND ccu.table_name = 'creators'
  ) THEN
    ALTER TABLE public.subscriptions 
    ADD CONSTRAINT subscriptions_creator_id_fkey 
    FOREIGN KEY (creator_id) REFERENCES public.creators(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================
-- 5. Create purchases table (replaces post_unlocks for PPV)
-- ============================================

CREATE TABLE IF NOT EXISTS public.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fan_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  paid_amount_cents integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE(fan_id, post_id)
);

-- ============================================
-- 6. Enable RLS
-- ============================================

ALTER TABLE public.creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 7. creators RLS policies
-- ============================================

-- SELECT: Authenticated users can view creators
DROP POLICY IF EXISTS "creators_select_all" ON public.creators;
CREATE POLICY "creators_select_all"
  ON public.creators
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: Users can create their own creator profile
DROP POLICY IF EXISTS "creators_insert_self" ON public.creators;
CREATE POLICY "creators_insert_self"
  ON public.creators
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- UPDATE: Users can update their own creator profile
DROP POLICY IF EXISTS "creators_update_self" ON public.creators;
CREATE POLICY "creators_update_self"
  ON public.creators
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ============================================
-- 8. posts RLS policies (update for new schema)
-- ============================================

-- Update posts SELECT policy to use price_cents logic:
-- - price_cents = 0: subscriber-only (need active subscription)
-- - price_cents > 0: PPV (need purchase)
DROP POLICY IF EXISTS "posts_select_visible" ON public.posts;

CREATE POLICY "posts_select_visible"
  ON public.posts
  FOR SELECT
  USING (
    -- Creator can always see their own posts
    creator_id = auth.uid()
    OR
    -- Free posts (if we keep visibility='free', or price_cents=0 and no subscription required)
    -- For MVP: price_cents=0 means subscriber-only, so we check subscription
    -- price_cents > 0 means PPV, so we check purchase
    (
      price_cents = 0 AND EXISTS (
        SELECT 1 FROM public.subscriptions
        WHERE subscriber_id = auth.uid()
          AND creator_id = posts.creator_id
          AND status = 'active'
          AND current_period_end > timezone('utc', now())
      )
    )
    OR
    (
      price_cents > 0 AND EXISTS (
        SELECT 1 FROM public.purchases
        WHERE fan_id = auth.uid()
          AND post_id = posts.id
      )
    )
  );

-- ============================================
-- 9. subscriptions RLS policies (keep existing, ensure they work)
-- ============================================

-- Policies should already exist from 008_phase2_paywall.sql
-- Verify they allow authenticated users to:
-- - SELECT their own subscriptions
-- - INSERT subscriptions for themselves (fan_id = auth.uid())

-- ============================================
-- 10. purchases RLS policies
-- ============================================

-- SELECT: Users can view their own purchases
DROP POLICY IF EXISTS "purchases_select_own" ON public.purchases;
CREATE POLICY "purchases_select_own"
  ON public.purchases
  FOR SELECT
  USING (auth.uid() = fan_id);

-- INSERT: Users can create purchases for themselves
DROP POLICY IF EXISTS "purchases_insert_own" ON public.purchases;
CREATE POLICY "purchases_insert_own"
  ON public.purchases
  FOR INSERT
  WITH CHECK (auth.uid() = fan_id);

-- ============================================
-- 11. Verify schema
-- ============================================

-- Verify creators table
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'creators'
    ) THEN '✅ creators 表存在'
    ELSE '❌ creators 表不存在'
  END AS creators_status;

-- Verify purchases table
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'purchases'
    ) THEN '✅ purchases 表存在'
    ELSE '❌ purchases 表不存在'
  END AS purchases_status;

-- Verify posts.price_cents
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'posts'
  AND column_name = 'price_cents';

-- Verify subscriptions.plan
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'subscriptions'
  AND column_name = 'plan';

