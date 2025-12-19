-- 005_paywall_clean.sql
-- Paywall tables: subscriptions and post_unlocks
-- Execute this in Supabase Dashboard SQL Editor

-- 1. Create subscriptions table
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  creator_id uuid NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'expired')),
  current_period_end timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE(user_id)
);

-- 2. Create post_unlocks table
CREATE TABLE IF NOT EXISTS public.post_unlocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE(user_id, post_id)
);

-- 3. Create updated_at trigger function (if not exists)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Create updated_at trigger for subscriptions
DROP TRIGGER IF EXISTS set_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER set_subscriptions_updated_at
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- 5. Enable RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_unlocks ENABLE ROW LEVEL SECURITY;

-- 6. subscriptions RLS policies
DROP POLICY IF EXISTS "subscriptions_select_own" ON public.subscriptions;
CREATE POLICY "subscriptions_select_own"
  ON public.subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "subscriptions_insert_own" ON public.subscriptions;
CREATE POLICY "subscriptions_insert_own"
  ON public.subscriptions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "subscriptions_update_own" ON public.subscriptions;
CREATE POLICY "subscriptions_update_own"
  ON public.subscriptions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "subscriptions_delete_own" ON public.subscriptions;
CREATE POLICY "subscriptions_delete_own"
  ON public.subscriptions
  FOR DELETE
  USING (auth.uid() = user_id);

-- 7. post_unlocks RLS policies
DROP POLICY IF EXISTS "post_unlocks_select_own" ON public.post_unlocks;
CREATE POLICY "post_unlocks_select_own"
  ON public.post_unlocks
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "post_unlocks_insert_own" ON public.post_unlocks;
CREATE POLICY "post_unlocks_insert_own"
  ON public.post_unlocks
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "post_unlocks_delete_own" ON public.post_unlocks;
CREATE POLICY "post_unlocks_delete_own"
  ON public.post_unlocks
  FOR DELETE
  USING (auth.uid() = user_id);

-- 8. Verify tables created
DO $$
DECLARE
  subscriptions_exists boolean;
  post_unlocks_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'subscriptions'
  ) INTO subscriptions_exists;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'post_unlocks'
  ) INTO post_unlocks_exists;
  
  IF subscriptions_exists AND post_unlocks_exists THEN
    RAISE NOTICE 'Tables created successfully';
  ELSE
    RAISE WARNING 'Table creation may have failed';
  END IF;
END $$;

-- 9. Show all policies
SELECT 
  tablename,
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename IN ('subscriptions', 'post_unlocks')
ORDER BY tablename, policyname;

