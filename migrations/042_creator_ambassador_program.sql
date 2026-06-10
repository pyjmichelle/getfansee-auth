-- ============================================================
-- Migration 042: Creator Ambassador Program
-- ============================================================
-- Phase: 1 (additive schema only; no app code changed)
-- Purpose: Introduce tables, RLS policies, safe view, and
--          default settings for the Creator Ambassador referral
--          program.
--
-- Design rules:
--   - Additive only. No existing tables altered (except a
--     comment-only annotation on profiles.referrer_id).
--   - creator_referral_attributions is the single source of
--     truth for attribution; profiles.referrer_id is legacy
--     read-only and must NOT drive commission accrual.
--   - Commission amounts in MVP are internal *estimated*
--     pending records. They are NOT withdrawable and do NOT
--     touch wallet_accounts balances.
--   - All client writes are denied; service-role only.
--   - RLS deny-by-default on all five tables.
--
-- Next migration: 043_*
-- Rollback: drop the five tables, the view, and the grants
--           (see rollback comment at the bottom).
-- ============================================================

BEGIN;

-- ──────────────────────────────────────────────────────────
-- 0. Verify preconditions
-- ──────────────────────────────────────────────────────────
DO $$
BEGIN
  -- set_updated_at must already exist (from migration 001/002/005/007)
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'set_updated_at'
  ) THEN
    RAISE EXCEPTION '[042] set_updated_at() function not found – run migrations 001+ first';
  END IF;

  -- profiles table must exist (core schema)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profiles'
  ) THEN
    RAISE EXCEPTION '[042] public.profiles table not found – run migration 001 first';
  END IF;

  -- profiles.referrer_id must exist (from migration 017)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'referrer_id'
  ) THEN
    RAISE EXCEPTION '[042] profiles.referrer_id not found – run migration 017 first';
  END IF;

  -- profiles.is_banned must exist (from migration 018)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'is_banned'
  ) THEN
    RAISE EXCEPTION '[042] profiles.is_banned not found – run migration 018 first';
  END IF;

  RAISE NOTICE '[042] Preconditions OK';
END $$;

-- ──────────────────────────────────────────────────────────
-- 1. creator_referral_settings  (singleton config)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.creator_referral_settings (
  id                     int             PRIMARY KEY CHECK (id = 1),
  program_enabled        boolean         NOT NULL DEFAULT true,
  commission_percent     numeric(5,2)    NOT NULL DEFAULT 5.00,
  duration_months        int             NOT NULL DEFAULT 12,
  commission_cap_cents   bigint          NULL,       -- NULL = disabled
  approval_delay_days    int             NOT NULL DEFAULT 0,
  require_admin_approval boolean         NOT NULL DEFAULT true,
  mirror_to_ledger       boolean         NOT NULL DEFAULT false,
  created_at             timestamptz     NOT NULL DEFAULT timezone('utc', now()),
  updated_at             timestamptz     NOT NULL DEFAULT timezone('utc', now())
);

COMMENT ON TABLE  public.creator_referral_settings IS 'Singleton (id=1) configuration for the Creator Ambassador Program. Edit via admin UI only.';
COMMENT ON COLUMN public.creator_referral_settings.commission_percent IS 'Estimated reward rate applied to eligible transaction amount. Not a legally payable % until payout system exists.';
COMMENT ON COLUMN public.creator_referral_settings.mirror_to_ledger   IS 'If true, approved commissions emit a transactions row for audit only; does NOT touch wallet balances.';

DROP TRIGGER IF EXISTS set_creator_referral_settings_updated_at ON public.creator_referral_settings;
CREATE TRIGGER set_creator_referral_settings_updated_at
  BEFORE UPDATE ON public.creator_referral_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ──────────────────────────────────────────────────────────
-- 2. creator_referral_profiles  (one per ambassador)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.creator_referral_profiles (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  referral_code text        NOT NULL UNIQUE,
  status        text        NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'suspended')),
  created_at    timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at    timestamptz NOT NULL DEFAULT timezone('utc', now())
);

COMMENT ON TABLE  public.creator_referral_profiles IS 'One row per verified creator enrolled as an ambassador. referral_code is opaque (random slug).';

CREATE INDEX IF NOT EXISTS idx_creator_referral_profiles_user_id
  ON public.creator_referral_profiles (user_id);

CREATE INDEX IF NOT EXISTS idx_creator_referral_profiles_code
  ON public.creator_referral_profiles (referral_code);

DROP TRIGGER IF EXISTS set_creator_referral_profiles_updated_at ON public.creator_referral_profiles;
CREATE TRIGGER set_creator_referral_profiles_updated_at
  BEFORE UPDATE ON public.creator_referral_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ──────────────────────────────────────────────────────────
-- 3. creator_referral_attributions  (one per referred user)
-- ──────────────────────────────────────────────────────────
-- Status values:
--   signup_completed | creator_role_selected | kyc_verified |
--   qualified | revenue_eligible | rejected | fraud
--
-- Note: fine-grained funnel sub-states (profile_ready,
--   first_paid_content_created, first_eligible_revenue) live
--   only in creator_referral_events; they are NOT stored in
--   this status column to avoid schema churn.
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.creator_referral_attributions (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_user_id  uuid        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  referral_code     text        NOT NULL,  -- snapshot of the code used at bind time
  source            text        NOT NULL DEFAULT 'ambassador_program'
                                CHECK (source IN (
                                  'ambassador_program',
                                  'legacy_profiles_referrer_id',
                                  'admin_override'
                                )),
  status            text        NOT NULL DEFAULT 'signup_completed'
                                CHECK (status IN (
                                  'signup_completed',
                                  'creator_role_selected',
                                  'kyc_verified',
                                  'qualified',
                                  'revenue_eligible',
                                  'rejected',
                                  'fraud'
                                )),
  qualified_at      timestamptz NULL,   -- set when status reaches 'qualified'
  window_ends_at    timestamptz NULL,   -- qualified_at + duration_months
  risk_flags        text[]      NOT NULL DEFAULT '{}',
  is_fraud          boolean     NOT NULL DEFAULT false,
  signup_ip         inet        NULL,   -- captured at bind; for duplicate detection
  bound_by_admin    uuid        NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at        timestamptz NOT NULL DEFAULT timezone('utc', now()),

  -- self-referral guard at DB level
  CONSTRAINT chk_no_self_referral
    CHECK (referrer_user_id <> referred_user_id)
);

COMMENT ON TABLE  public.creator_referral_attributions IS 'One row per referred user. Single source of truth for attribution. profiles.referrer_id is legacy read-only and must NOT drive commission accrual.';
COMMENT ON COLUMN public.creator_referral_attributions.source IS 'ambassador_program = organic Ambassador flow; legacy_profiles_referrer_id = one-time backfill (out of scope for MVP); admin_override = admin manually changed.';
COMMENT ON COLUMN public.creator_referral_attributions.risk_flags IS 'Advisory flags: email_duplicate, ip_duplicate, device_duplicate, kyc_duplicate. Do not auto-block; surface in admin.';

CREATE INDEX IF NOT EXISTS idx_creator_referral_attr_referrer
  ON public.creator_referral_attributions (referrer_user_id);

CREATE INDEX IF NOT EXISTS idx_creator_referral_attr_referred
  ON public.creator_referral_attributions (referred_user_id);

CREATE INDEX IF NOT EXISTS idx_creator_referral_attr_code
  ON public.creator_referral_attributions (referral_code);

CREATE INDEX IF NOT EXISTS idx_creator_referral_attr_status
  ON public.creator_referral_attributions (status);

DROP TRIGGER IF EXISTS set_creator_referral_attributions_updated_at ON public.creator_referral_attributions;
CREATE TRIGGER set_creator_referral_attributions_updated_at
  BEFORE UPDATE ON public.creator_referral_attributions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ──────────────────────────────────────────────────────────
-- 4. creator_referral_events  (immutable audit log)
-- ──────────────────────────────────────────────────────────
-- event_type values (canonical):
--   clicked | signup_started | signup_completed |
--   creator_role_selected | kyc_verified |
--   profile_ready | first_paid_content_created |
--   first_eligible_revenue | qualified | revenue_eligible |
--   commission_accrued | commission_approved |
--   commission_rejected | commission_voided |
--   fraud_flag | admin_override | attribution_rejected
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.creator_referral_events (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  attribution_id   uuid        NULL REFERENCES public.creator_referral_attributions(id) ON DELETE CASCADE,
  referral_code    text        NULL,   -- for click events before attribution row exists
  event_type       text        NOT NULL,
  actor_user_id    uuid        NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata         jsonb       NOT NULL DEFAULT '{}',
  created_at       timestamptz NOT NULL DEFAULT timezone('utc', now())
);

COMMENT ON TABLE  public.creator_referral_events IS 'Immutable audit trail. No UPDATE/DELETE; insert only. Powers analytics and explains admin decisions.';
COMMENT ON COLUMN public.creator_referral_events.metadata IS 'Context: { ip_hash, status_before, status_after, admin_note, reason_code, amounts (admin-only) }';

CREATE INDEX IF NOT EXISTS idx_creator_referral_events_attribution
  ON public.creator_referral_events (attribution_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_creator_referral_events_type
  ON public.creator_referral_events (event_type, created_at DESC);

-- ──────────────────────────────────────────────────────────
-- 5. creator_referral_commissions
-- ──────────────────────────────────────────────────────────
-- IMPORTANT: All amounts are INTERNAL ESTIMATED RECORDS.
--   estimated_commission_amount_cents  = used in MVP (accrued estimate)
--   approved_commission_amount_cents   = used in MVP (after admin approval)
--   payable_commission_amount_cents    = RESERVED, always NULL in MVP
--                                        (requires future payout system)
--
-- eligible revenue = successful paid transactions (ppv_revenue /
--   subscription, status='completed') that are NOT refunded,
--   NOT failed, NOT self-purchase, NOT tied to fraud/rejected
--   attribution. Chargeback / void / test exclusions are a
--   known limitation (transactions table has no such states).
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.creator_referral_commissions (
  id                                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  attribution_id                    uuid          NOT NULL REFERENCES public.creator_referral_attributions(id) ON DELETE CASCADE,
  referrer_user_id                  uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_user_id                  uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_start                      timestamptz   NOT NULL,
  period_end                        timestamptz   NOT NULL,
  basis_revenue_cents               bigint        NOT NULL,           -- admin-only; sum of eligible revenue in period
  commission_percent                numeric(5,2)  NOT NULL,           -- snapshot at accrual time
  estimated_commission_amount_cents bigint        NOT NULL CHECK (estimated_commission_amount_cents >= 0),
  approved_commission_amount_cents  bigint        NULL     CHECK (approved_commission_amount_cents >= 0),
  payable_commission_amount_cents   bigint        NULL     CHECK (payable_commission_amount_cents >= 0),  -- RESERVED for MVP
  status                            text          NOT NULL DEFAULT 'pending'
                                                  CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
  reviewed_by                       uuid          NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at                       timestamptz   NULL,
  review_note                       text          NULL,
  status_reason                     text          NULL,  -- refund|chargeback|duplicate_account|policy_violation|account_suspended|dmca|payout_disputed|risk_flag|other
  admin_action_source               text          NULL,  -- admin_ui|cron_recompute|script
  ledger_transaction_id             uuid          NULL REFERENCES public.transactions(id) ON DELETE SET NULL,
  created_at                        timestamptz   NOT NULL DEFAULT timezone('utc', now()),
  updated_at                        timestamptz   NOT NULL DEFAULT timezone('utc', now()),

  CONSTRAINT uq_commission_period UNIQUE (attribution_id, period_start, period_end),
  CONSTRAINT chk_period_order CHECK (period_end > period_start)
);

COMMENT ON TABLE  public.creator_referral_commissions IS 'Internal estimated pending reward records. NOT withdrawable. Does NOT touch wallet_accounts. payable_commission_amount_cents is reserved/NULL until future payout system.';
COMMENT ON COLUMN public.creator_referral_commissions.basis_revenue_cents IS 'Admin-only. Sum of eligible referred-creator revenue in period. Must NEVER be exposed to the referrer.';
COMMENT ON COLUMN public.creator_referral_commissions.payable_commission_amount_cents IS 'RESERVED. Always NULL in MVP. Set only by future payout system design.';

CREATE INDEX IF NOT EXISTS idx_creator_referral_comm_referrer
  ON public.creator_referral_commissions (referrer_user_id);

CREATE INDEX IF NOT EXISTS idx_creator_referral_comm_attribution
  ON public.creator_referral_commissions (attribution_id);

CREATE INDEX IF NOT EXISTS idx_creator_referral_comm_status
  ON public.creator_referral_commissions (status, created_at DESC);

DROP TRIGGER IF EXISTS set_creator_referral_commissions_updated_at ON public.creator_referral_commissions;
CREATE TRIGGER set_creator_referral_commissions_updated_at
  BEFORE UPDATE ON public.creator_referral_commissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ──────────────────────────────────────────────────────────
-- 6. ambassador_referrals_safe  (security-barrier view)
--    Referrer-facing: safe public fields only.
--    NEVER exposes: earnings, email, KYC, buyers, risk_flags,
--                   signup_ip, basis_revenue_cents.
-- ──────────────────────────────────────────────────────────
DROP VIEW IF EXISTS public.ambassador_referrals_safe;
CREATE VIEW public.ambassador_referrals_safe
  WITH (security_barrier = true) AS
SELECT
  a.id,
  a.referrer_user_id,
  a.status,
  a.qualified_at,
  a.created_at,
  -- Show public creator handle/avatar; mask pre-creator / not-yet-public users.
  -- Join directly to profiles (not the public_creator_profiles view) so this
  -- migration is independent of whether migrations 025/031 have run.
  -- Only expose display_name/avatar_url; never email, username, or private fields.
  COALESCE(
    CASE WHEN p.role = 'creator' AND NOT COALESCE(p.is_banned, false)
         THEN p.display_name END,
    'Pending creator'
  ) AS display_name,
  CASE WHEN p.role = 'creator' AND NOT COALESCE(p.is_banned, false)
       THEN p.avatar_url END AS avatar_url
FROM  public.creator_referral_attributions a
LEFT JOIN public.profiles p ON p.id = a.referred_user_id
WHERE a.is_fraud = false
  AND a.status NOT IN ('fraud');

COMMENT ON VIEW public.ambassador_referrals_safe IS
  'Referrer-facing safe projection. No earnings, email, KYC, buyers, risk_flags, or signup_ip. '
  'Masks non-creator referred users as "Pending creator".';

GRANT SELECT ON public.ambassador_referrals_safe TO authenticated;

-- ──────────────────────────────────────────────────────────
-- 7. Row-Level Security (RLS)
-- ──────────────────────────────────────────────────────────

-- 7a. creator_referral_settings ─ admin read/write only
ALTER TABLE public.creator_referral_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS creator_referral_settings_select_admin ON public.creator_referral_settings;
CREATE POLICY creator_referral_settings_select_admin
  ON public.creator_referral_settings FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ));

DROP POLICY IF EXISTS creator_referral_settings_modify_admin ON public.creator_referral_settings;
CREATE POLICY creator_referral_settings_modify_admin
  ON public.creator_referral_settings FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ));

-- 7b. creator_referral_profiles ─ own read; no client writes
ALTER TABLE public.creator_referral_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS creator_referral_profiles_select_own ON public.creator_referral_profiles;
CREATE POLICY creator_referral_profiles_select_own
  ON public.creator_referral_profiles FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS creator_referral_profiles_select_admin ON public.creator_referral_profiles;
CREATE POLICY creator_referral_profiles_select_admin
  ON public.creator_referral_profiles FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ));

-- No INSERT/UPDATE policies for clients: service role writes via server routes.

-- 7c. creator_referral_attributions ─ deny direct client reads; admin full
--     Ambassador reads are served via ambassador_referrals_safe view + API
--     with explicit projection using service role.
ALTER TABLE public.creator_referral_attributions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS creator_referral_attributions_select_admin ON public.creator_referral_attributions;
CREATE POLICY creator_referral_attributions_select_admin
  ON public.creator_referral_attributions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ));

-- No other SELECT policies: deny-by-default for clients.
-- Service role bypasses RLS.

-- 7d. creator_referral_events ─ admin read only; insert via service role
ALTER TABLE public.creator_referral_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS creator_referral_events_select_admin ON public.creator_referral_events;
CREATE POLICY creator_referral_events_select_admin
  ON public.creator_referral_events FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ));

-- 7e. creator_referral_commissions ─ admin full; no direct client writes
ALTER TABLE public.creator_referral_commissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS creator_referral_commissions_select_admin ON public.creator_referral_commissions;
CREATE POLICY creator_referral_commissions_select_admin
  ON public.creator_referral_commissions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ));

DROP POLICY IF EXISTS creator_referral_commissions_modify_admin ON public.creator_referral_commissions;
CREATE POLICY creator_referral_commissions_modify_admin
  ON public.creator_referral_commissions FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ));

-- Ambassador commission summary is served via API routes (service role)
-- with explicit projection that EXCLUDES basis_revenue_cents.
-- No referrer SELECT policy on the base table: defend by API projection.

-- ──────────────────────────────────────────────────────────
-- 8. Seed default settings row (idempotent)
-- ──────────────────────────────────────────────────────────
INSERT INTO public.creator_referral_settings (
  id,
  program_enabled,
  commission_percent,
  duration_months,
  commission_cap_cents,
  approval_delay_days,
  require_admin_approval,
  mirror_to_ledger
) VALUES (
  1,
  true,
  5.00,
  12,
  NULL,   -- cap disabled
  0,      -- 0 = manual admin approval required (not delay-based)
  true,
  false
)
ON CONFLICT (id) DO NOTHING;

-- ──────────────────────────────────────────────────────────
-- 9. Annotate legacy field (documentation only)
-- ──────────────────────────────────────────────────────────
COMMENT ON COLUMN public.profiles.referrer_id IS
  'LEGACY: Set by the old ?ref=userId referral system (migration 017). '
  'Read-only compatibility data. Do NOT use for commission accrual. '
  'creator_referral_attributions is the authoritative source of truth.';

-- ──────────────────────────────────────────────────────────
-- 10. Verification
-- ──────────────────────────────────────────────────────────
DO $$
DECLARE
  v_tables   text[] := ARRAY[
    'creator_referral_settings',
    'creator_referral_profiles',
    'creator_referral_attributions',
    'creator_referral_events',
    'creator_referral_commissions'
  ];
  v_table    text;
  v_count    int;
  v_settings jsonb;
BEGIN
  -- Check all five tables exist
  FOREACH v_table IN ARRAY v_tables LOOP
    SELECT COUNT(*) INTO v_count
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = v_table;
    IF v_count = 0 THEN
      RAISE EXCEPTION '[042] Table % was not created', v_table;
    END IF;
    RAISE NOTICE '[042] Table OK: %', v_table;
  END LOOP;

  -- Check safe view exists
  SELECT COUNT(*) INTO v_count
  FROM information_schema.views
  WHERE table_schema = 'public' AND table_name = 'ambassador_referrals_safe';
  IF v_count = 0 THEN
    RAISE EXCEPTION '[042] View ambassador_referrals_safe was not created';
  END IF;
  RAISE NOTICE '[042] View OK: ambassador_referrals_safe';

  -- Smoke-test view is queryable (confirms profiles JOIN works)
  PERFORM 1 FROM public.ambassador_referrals_safe LIMIT 0;

  -- Check settings seed row
  SELECT COUNT(*) INTO v_count
  FROM public.creator_referral_settings WHERE id = 1;
  IF v_count = 0 THEN
    RAISE EXCEPTION '[042] Settings seed row (id=1) not found';
  END IF;

  SELECT jsonb_build_object(
    'commission_percent',     commission_percent,
    'duration_months',        duration_months,
    'require_admin_approval', require_admin_approval,
    'mirror_to_ledger',       mirror_to_ledger,
    'program_enabled',        program_enabled
  ) INTO v_settings
  FROM public.creator_referral_settings WHERE id = 1;

  RAISE NOTICE '[042] Settings seed OK: %', v_settings;
  RAISE NOTICE '[042] Migration 042 completed successfully';
END $$;

COMMIT;

-- ──────────────────────────────────────────────────────────
-- ROLLBACK NOTES (do not run automatically)
-- ──────────────────────────────────────────────────────────
-- To roll back this migration (drops new objects only;
-- does NOT restore profiles.referrer_id comment):
--
--   DROP VIEW  IF EXISTS public.ambassador_referrals_safe;
--   DROP TABLE IF EXISTS public.creator_referral_commissions;
--   DROP TABLE IF EXISTS public.creator_referral_events;
--   DROP TABLE IF EXISTS public.creator_referral_attributions;
--   DROP TABLE IF EXISTS public.creator_referral_profiles;
--   DROP TABLE IF EXISTS public.creator_referral_settings;
--
-- No existing data or tables are affected.
-- ──────────────────────────────────────────────────────────
