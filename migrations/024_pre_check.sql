-- ============================================
-- Pre-Migration Check for 024
-- ============================================
-- Run this BEFORE running 024_atomic_unlock_ppv.sql
-- to identify potential issues

-- 1. Check for duplicate usernames that would be generated
SELECT 
  LOWER(REPLACE(COALESCE(display_name, id::text), ' ', '_')) as would_be_username,
  COUNT(*) as count,
  ARRAY_AGG(id) as profile_ids
FROM public.profiles
WHERE username IS NULL
GROUP BY would_be_username
HAVING COUNT(*) > 1
ORDER BY count DESC;

-- 2. Check if username column already exists
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name = 'username';

-- 3. Check if idempotency_key column already exists
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'purchases'
  AND column_name = 'idempotency_key';

-- 4. Check if unlock_ppv function already exists
SELECT 
  proname as function_name,
  pg_get_functiondef(oid) as definition
FROM pg_proc
WHERE proname = 'unlock_ppv'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- 5. Count profiles that need username backfill
SELECT 
  COUNT(*) as profiles_needing_username
FROM public.profiles
WHERE username IS NULL;

-- 6. Check for existing purchases without idempotency_key
SELECT 
  COUNT(*) as purchases_without_idempotency
FROM public.purchases
WHERE idempotency_key IS NULL;

-- Expected output:
-- - Query 1: Should return 0 rows (no duplicates)
-- - Query 2: Should return 0 rows (column doesn't exist yet) OR 1 row if already exists
-- - Query 3: Should return 0 rows (column doesn't exist yet) OR 1 row if already exists
-- - Query 4: Should return 0 rows (function doesn't exist yet) OR 1 row if already exists
-- - Query 5: Should return count of profiles (all if first run)
-- - Query 6: Should return count of existing purchases
