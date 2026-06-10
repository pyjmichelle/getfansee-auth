-- Migration 044: Tipping / Buy-me-a-coffee
-- Goals:
-- 1) Extend transactions.type CHECK constraint to include 'tip'
-- 2) Create audit tips table (idempotency + message + audit trail)
-- 3) RLS: fan or creator can SELECT their own rows; INSERT is service-role only
-- 4) Indexes for creator earnings queries and fan history
--
-- Financial model (Phase 2 MVP):
--   - Full tip amount goes to creator pending_balance_cents (no platform fee yet)
--   - available_balance_cents is NOT updated (pending = not withdrawable)
--   - Platform fee / real settlement deferred to Phase 6

-- --------------------------------------------
-- 1. Extend transactions.type CHECK constraint
--    (migration 030 defined the original constraint)
-- --------------------------------------------
ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_type_check;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_type_check
  CHECK (type IN (
    'deposit',
    'withdrawal',
    'subscription',
    'ppv_purchase',
    'ppv_unlock',
    'ppv_revenue',
    'commission',
    'payout',
    'tip'
  ));

-- --------------------------------------------
-- 2. Create tips table
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS public.tips (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  fan_id           uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  creator_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id          uuid        NULL        REFERENCES public.posts(id) ON DELETE SET NULL,
  amount_cents     bigint      NOT NULL CHECK (amount_cents > 0),
  message          text        NULL CHECK (char_length(message) <= 140),
  idempotency_key  text        NOT NULL UNIQUE,
  created_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT tips_no_self_tip CHECK (fan_id <> creator_id)
);

COMMENT ON TABLE public.tips IS
  'Audit log of fan-to-creator tips. Financial state is managed via wallet_accounts + transactions. '
  'Tips are immutable once created (no update/delete except admin).';

-- --------------------------------------------
-- 3. Row-Level Security
-- --------------------------------------------
ALTER TABLE public.tips ENABLE ROW LEVEL SECURITY;

-- Fan can read their own sent tips; creator can read tips they received
CREATE POLICY tips_select_self_or_creator
  ON public.tips
  FOR SELECT
  USING (
    auth.uid() = fan_id
    OR auth.uid() = creator_id
  );

-- INSERT / UPDATE / DELETE: service role only (API uses admin client)
-- No additional policies needed — default-deny covers non-service roles

GRANT SELECT ON public.tips TO authenticated;

-- --------------------------------------------
-- 4. Indexes
-- --------------------------------------------
-- Creator earnings queries (sorted by recency)
CREATE INDEX IF NOT EXISTS idx_tips_creator_created_at
  ON public.tips(creator_id, created_at DESC);

-- Fan history
CREATE INDEX IF NOT EXISTS idx_tips_fan_id
  ON public.tips(fan_id);

-- Idempotency lookup (already covered by UNIQUE constraint, explicit index for visibility)
CREATE INDEX IF NOT EXISTS idx_tips_idempotency_key
  ON public.tips(idempotency_key);

-- --------------------------------------------
-- 5. Verification
-- --------------------------------------------
DO $$
DECLARE
  v_table_exists     boolean;
  v_constraint_has_tip boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tips'
  ) INTO v_table_exists;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_schema = 'public'
      AND constraint_name   = 'transactions_type_check'
      AND check_clause LIKE '%tip%'
  ) INTO v_constraint_has_tip;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration 044 Verification:';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'tips table exists: %',                v_table_exists;
  RAISE NOTICE 'transactions_type_check has tip: %',  v_constraint_has_tip;
  RAISE NOTICE '========================================';
END $$;
