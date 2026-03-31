-- ============================================
-- Migration 038: Update support_tickets table
-- - Make user_id nullable (allow anonymous submissions)
-- - Add category column for contact reason
-- ============================================

-- 1. Make user_id nullable so anonymous users can submit tickets
ALTER TABLE public.support_tickets
  ALTER COLUMN user_id DROP NOT NULL;

-- 2. Add category column for contact reason
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS category text;

-- 3. Update RLS policy to allow anonymous inserts via service role
-- (The API route uses admin client which bypasses RLS, so no policy change needed.
--  But we drop the strict user_id = auth.uid() check to allow nullable user_id.)
DROP POLICY IF EXISTS support_tickets_insert_own ON public.support_tickets;
CREATE POLICY support_tickets_insert_own
  ON public.support_tickets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id IS NULL OR user_id = auth.uid()
  );

-- Also allow anon role to insert (for truly anonymous submissions via API route)
DROP POLICY IF EXISTS support_tickets_insert_anon ON public.support_tickets;
CREATE POLICY support_tickets_insert_anon
  ON public.support_tickets
  FOR INSERT
  TO anon
  WITH CHECK (user_id IS NULL);

-- Verify
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'support_tickets' AND column_name = 'category'
    )
    THEN '✅ category column added'
    ELSE '❌ category column missing'
  END AS category_check,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'support_tickets'
        AND column_name = 'user_id'
        AND is_nullable = 'YES'
    )
    THEN '✅ user_id is nullable'
    ELSE '❌ user_id is still NOT NULL'
  END AS nullable_check;
