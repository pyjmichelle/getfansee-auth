-- ============================================
-- Rollback for Migration 024
-- ============================================
-- Use this if you need to rollback the migration

-- Drop RPC function
DROP FUNCTION IF EXISTS public.unlock_ppv(UUID, UUID, TEXT);

-- Remove unique constraint from profiles.username
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_username_key;

-- Drop index
DROP INDEX IF EXISTS public.idx_profiles_username;

-- Remove username column (optional - only if you want full rollback)
-- ALTER TABLE public.profiles DROP COLUMN IF EXISTS username;

-- Remove idempotency_key from purchases
DROP INDEX IF EXISTS public.idx_purchases_idempotency_key;
ALTER TABLE public.purchases DROP COLUMN IF EXISTS idempotency_key;

-- Note: This does NOT remove existing purchase/transaction data
-- Only removes the new columns and functions
