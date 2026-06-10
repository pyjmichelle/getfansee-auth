-- Migration 045: Creator tip settings + tip fee columns
-- Goals:
-- 1) Create creator_tip_settings (per-creator customization for the tip / buy-me-a-coffee panel)
-- 2) RLS: creator can read/write their own row; public can read settings for enabled creators
-- 3) Add platform_fee_cents / creator_net_cents to tips for fee transparency
--
-- Scope (confirmed): one-off appreciation tipping only.
--   - Custom preset amounts, unit label/emoji, thank-you message, single goal, supporter list toggle.
--   - NO membership tiers, NO promised deliverables, NO DM.
--   - Platform fee is a PLACEHOLDER 5% (PLATFORM_TIP_FEE_BPS) pending a platform-wide fee review.

-- --------------------------------------------
-- 1. creator_tip_settings table
-- --------------------------------------------
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

-- --------------------------------------------
-- 2. Row-Level Security
-- --------------------------------------------
ALTER TABLE public.creator_tip_settings ENABLE ROW LEVEL SECURITY;

-- Creator can read their own row
CREATE POLICY tip_settings_select_own
  ON public.creator_tip_settings
  FOR SELECT
  USING (auth.uid() = creator_id);

-- Anyone (incl. anon) can read settings for creators who enabled tipping
CREATE POLICY tip_settings_select_public_enabled
  ON public.creator_tip_settings
  FOR SELECT
  USING (enabled = true);

-- Creator can insert their own row
CREATE POLICY tip_settings_insert_own
  ON public.creator_tip_settings
  FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

-- Creator can update their own row
CREATE POLICY tip_settings_update_own
  ON public.creator_tip_settings
  FOR UPDATE
  USING (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id);

GRANT SELECT ON public.creator_tip_settings TO anon;
GRANT SELECT, INSERT, UPDATE ON public.creator_tip_settings TO authenticated;

-- --------------------------------------------
-- 3. Fee transparency columns on tips
-- --------------------------------------------
ALTER TABLE public.tips
  ADD COLUMN IF NOT EXISTS platform_fee_cents bigint NOT NULL DEFAULT 0 CHECK (platform_fee_cents >= 0);

ALTER TABLE public.tips
  ADD COLUMN IF NOT EXISTS creator_net_cents bigint NULL CHECK (creator_net_cents IS NULL OR creator_net_cents >= 0);

COMMENT ON COLUMN public.tips.platform_fee_cents IS
  'Platform service fee withheld from this tip (cents). Placeholder rate pending platform-wide fee review.';
COMMENT ON COLUMN public.tips.creator_net_cents IS
  'Net amount credited to creator pending balance after platform fee (cents).';

-- --------------------------------------------
-- 4. Index for supporter-list / goal queries
--    (idx_tips_creator_created_at already exists from migration 044)
-- --------------------------------------------

-- --------------------------------------------
-- 5. Verification
-- --------------------------------------------
DO $$
DECLARE
  v_table_exists       boolean;
  v_fee_col_exists     boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'creator_tip_settings'
  ) INTO v_table_exists;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tips' AND column_name = 'platform_fee_cents'
  ) INTO v_fee_col_exists;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration 045 Verification:';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'creator_tip_settings table exists: %', v_table_exists;
  RAISE NOTICE 'tips.platform_fee_cents column exists: %', v_fee_col_exists;
  RAISE NOTICE '========================================';
END $$;
