-- ============================================================
-- Combined apply script: migrations 044 + 045 (tips feature)
-- Paste into Supabase SQL Editor and run as a single batch.
-- Idempotent: safe to re-run.
-- Ends with a PostgREST schema cache reload (fixes PGRST205).
-- ============================================================

-- ------------------------------------------------------------
-- [044] 1. Extend transactions.type CHECK constraint
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- [044] 2. tips table
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- [044] 3. RLS on tips
-- ------------------------------------------------------------
ALTER TABLE public.tips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tips_select_self_or_creator ON public.tips;
CREATE POLICY tips_select_self_or_creator
  ON public.tips
  FOR SELECT
  USING (
    auth.uid() = fan_id
    OR auth.uid() = creator_id
  );

-- INSERT / UPDATE / DELETE: service role only (API uses admin client)
GRANT SELECT ON public.tips TO authenticated;

-- ------------------------------------------------------------
-- [044] 4. Indexes
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_tips_creator_created_at
  ON public.tips(creator_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tips_fan_id
  ON public.tips(fan_id);

CREATE INDEX IF NOT EXISTS idx_tips_idempotency_key
  ON public.tips(idempotency_key);

-- ------------------------------------------------------------
-- [045] 1. creator_tip_settings table
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.creator_tip_settings (
  creator_id          uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled             boolean     NOT NULL DEFAULT true,
  unit_label          text        NOT NULL DEFAULT 'coffee' CHECK (char_length(unit_label) <= 24),
  unit_emoji          text        NOT NULL DEFAULT '☕' CHECK (char_length(unit_emoji) <= 8),
  preset_amounts_cents integer[]  NOT NULL DEFAULT '{100,500,1000,2000}',
  thank_you_message   text        NULL CHECK (char_length(thank_you_message) <= 280),
  goal_enabled        boolean     NOT NULL DEFAULT false,
  goal_title          text        NULL CHECK (char_length(goal_title) <= 80),
  goal_target_cents   bigint      NULL CHECK (goal_target_cents IS NULL OR goal_target_cents > 0),
  goal_started_at     timestamptz NULL,
  show_supporters     boolean     NOT NULL DEFAULT true,
  updated_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.creator_tip_settings IS
  'Per-creator customization for the one-off tip panel (amounts, label, thank-you, goal, supporter list). '
  'Tips remain voluntary gratuities; this table must never encode promised deliverables (quid-pro-quo).';

-- ------------------------------------------------------------
-- [045] 2. RLS on creator_tip_settings
-- ------------------------------------------------------------
ALTER TABLE public.creator_tip_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tip_settings_select_own ON public.creator_tip_settings;
CREATE POLICY tip_settings_select_own
  ON public.creator_tip_settings
  FOR SELECT
  USING (auth.uid() = creator_id);

DROP POLICY IF EXISTS tip_settings_select_public_enabled ON public.creator_tip_settings;
CREATE POLICY tip_settings_select_public_enabled
  ON public.creator_tip_settings
  FOR SELECT
  USING (enabled = true);

DROP POLICY IF EXISTS tip_settings_insert_own ON public.creator_tip_settings;
CREATE POLICY tip_settings_insert_own
  ON public.creator_tip_settings
  FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS tip_settings_update_own ON public.creator_tip_settings;
CREATE POLICY tip_settings_update_own
  ON public.creator_tip_settings
  FOR UPDATE
  USING (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id);

GRANT SELECT ON public.creator_tip_settings TO anon;
GRANT SELECT, INSERT, UPDATE ON public.creator_tip_settings TO authenticated;

-- ------------------------------------------------------------
-- [045] 3. Fee transparency columns on tips
-- ------------------------------------------------------------
ALTER TABLE public.tips
  ADD COLUMN IF NOT EXISTS platform_fee_cents bigint NOT NULL DEFAULT 0 CHECK (platform_fee_cents >= 0);

ALTER TABLE public.tips
  ADD COLUMN IF NOT EXISTS creator_net_cents bigint NULL CHECK (creator_net_cents IS NULL OR creator_net_cents >= 0);

COMMENT ON COLUMN public.tips.platform_fee_cents IS
  'Platform service fee withheld from this tip (cents). Placeholder rate pending platform-wide fee review.';
COMMENT ON COLUMN public.tips.creator_net_cents IS
  'Net amount credited to creator pending balance after platform fee (cents).';

-- ------------------------------------------------------------
-- Reload PostgREST schema cache (fixes PGRST205)
-- ------------------------------------------------------------
NOTIFY pgrst, 'reload schema';

-- ------------------------------------------------------------
-- Verification
-- ------------------------------------------------------------
DO $$
DECLARE
  v_tips_exists         boolean;
  v_settings_exists     boolean;
  v_fee_col_exists      boolean;
  v_constraint_has_tip  boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tips'
  ) INTO v_tips_exists;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'creator_tip_settings'
  ) INTO v_settings_exists;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tips' AND column_name = 'platform_fee_cents'
  ) INTO v_fee_col_exists;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_schema = 'public'
      AND constraint_name   = 'transactions_type_check'
      AND check_clause LIKE '%tip%'
  ) INTO v_constraint_has_tip;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Tips 044+045 combined apply verification:';
  RAISE NOTICE 'tips table exists:                     %', v_tips_exists;
  RAISE NOTICE 'creator_tip_settings table exists:     %', v_settings_exists;
  RAISE NOTICE 'tips.platform_fee_cents exists:        %', v_fee_col_exists;
  RAISE NOTICE 'transactions_type_check includes tip:  %', v_constraint_has_tip;
  RAISE NOTICE '========================================';
END $$;
