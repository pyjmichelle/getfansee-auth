-- 059_financial_security_lockdown.sql
-- P0 containment: lock financial RPCs, protect privileged profile fields,
-- remove browser-writable wallet balances, and make PPV pricing authoritative.

-- Future functions must not silently inherit browser-callable EXECUTE grants.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO service_role;

-- A wallet balance is ledger state, never user-editable profile state.
DROP POLICY IF EXISTS "wallet_accounts_update_own" ON public.wallet_accounts;

-- Keep the existing self-service profile policy for display fields, but stop it
-- from being used to promote a user, approve KYC, unban an account, or change
-- commission settings. Admin/service-role writes continue to work.
CREATE OR REPLACE FUNCTION public.protect_profile_privileged_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_key text;
  v_protected_keys constant text[] := ARRAY[
    'id', 'email', 'role', 'age_verified', 'is_banned', 'is_verified',
    'commission_free_until', 'kyc_provider', 'kyc_session_id',
    'kyc_verification_url', 'kyc_external_status', 'kyc_started_at',
    'kyc_submitted_at', 'kyc_decided_at', 'kyc_last_error', 'kyc_country',
    'kyc_age_verified', 'kyc_raw_payload'
  ];
BEGIN
  IF current_user NOT IN ('postgres', 'service_role', 'supabase_admin') THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.id IS DISTINCT FROM auth.uid()
         OR NEW.role IS DISTINCT FROM 'fan'
         OR COALESCE(NEW.age_verified, false)
         OR COALESCE(NEW.is_banned, false)
         OR COALESCE(NEW.is_verified, false)
         OR NEW.commission_free_until IS NOT NULL
         OR NEW.kyc_session_id IS NOT NULL
         OR NEW.kyc_external_status IS NOT NULL
         OR COALESCE(NEW.kyc_age_verified, false)
         OR NEW.kyc_raw_payload IS NOT NULL THEN
        RAISE EXCEPTION 'privileged profile fields cannot be set by the current user'
          USING ERRCODE = '42501';
      END IF;
      RETURN NEW;
    END IF;

    FOREACH v_key IN ARRAY v_protected_keys LOOP
      IF (to_jsonb(NEW) -> v_key) IS DISTINCT FROM (to_jsonb(OLD) -> v_key) THEN
        RAISE EXCEPTION 'profile field % cannot be changed by the current user', v_key
          USING ERRCODE = '42501';
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_privileged_fields ON public.profiles;
CREATE TRIGGER protect_profile_privileged_fields
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_privileged_fields();

-- Replace the PPV wrapper without changing its published signature. Legacy
-- arguments remain for a zero-downtime rollout, but price, creator, fee and
-- settlement date are derived inside the same transaction and never trusted.
CREATE OR REPLACE FUNCTION public.spend_wallet_on_ppv(
  p_fan_id           UUID,
  p_post_id          UUID,
  p_creator_id       UUID,
  p_price_cents      BIGINT,
  p_platform_fee_bps INTEGER,
  p_idempotency_key  TEXT,
  p_buyer_country    TEXT,
  p_buyer_region     TEXT,
  p_available_on     TIMESTAMPTZ
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_spend            JSON;
  v_purchase_id      UUID;
  v_balance          BIGINT;
  v_creator_id       UUID;
  v_price_cents      BIGINT;
  v_platform_fee_bps INTEGER;
  v_available_on     TIMESTAMPTZ := timezone('utc', now()) + interval '7 days';
BEGIN
  SELECT posts.creator_id, posts.price_cents
    INTO v_creator_id, v_price_cents
  FROM public.posts
  WHERE posts.id = p_post_id
    AND posts.visibility = 'ppv'
  FOR SHARE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Post is not available for PPV');
  END IF;
  IF v_price_cents IS NULL OR v_price_cents <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Invalid post price');
  END IF;

  -- Fee policy is authoritative here too: 0% during an active founding window,
  -- otherwise the standard 20%. Caller-supplied fee/price/payee values are
  -- deliberately ignored.
  SELECT CASE
    WHEN profiles.commission_free_until > timezone('utc', now()) THEN 0
    ELSE 2000
  END
  INTO v_platform_fee_bps
  FROM public.profiles
  WHERE profiles.id = v_creator_id;
  v_platform_fee_bps := COALESCE(v_platform_fee_bps, 2000);

  SELECT id INTO v_purchase_id
  FROM public.purchases
  WHERE fan_id = p_fan_id AND post_id = p_post_id;

  IF FOUND THEN
    SELECT available_balance_cents INTO v_balance
    FROM public.wallet_accounts WHERE user_id = p_fan_id;
    RETURN json_build_object(
      'success', true, 'idempotent', true,
      'purchase_id', v_purchase_id,
      'balance_after_cents', COALESCE(v_balance, 0)
    );
  END IF;

  v_spend := public.spend_wallet(
    p_fan_id, v_creator_id, 'ppv', v_price_cents, v_platform_fee_bps,
    p_idempotency_key, 'purchase', NULL, p_buyer_country, p_buyer_region,
    v_available_on
  );

  IF (v_spend->>'success')::boolean IS NOT TRUE THEN
    RETURN v_spend;
  END IF;

  INSERT INTO public.purchases (fan_id, post_id, paid_amount_cents, idempotency_key)
  VALUES (p_fan_id, p_post_id, v_price_cents, p_idempotency_key)
  RETURNING id INTO v_purchase_id;

  UPDATE public.consumption_orders
  SET reference_id = v_purchase_id
  WHERE id = (v_spend->>'consumption_order_id')::uuid;

  RETURN jsonb_set(v_spend::jsonb, '{purchase_id}', to_jsonb(v_purchase_id))::json;
END;
$$;

-- Revoke every overload of known money-moving/reporting functions. This is
-- intentionally dynamic so older environments with legacy overloads are also
-- contained. Only the server's service role may execute them afterwards.
DO $$
DECLARE
  v_proc record;
BEGIN
  FOR v_proc IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY (ARRAY[
        'open_payment_order', 'credit_payram_deposit',
        'credit_nowpayments_deposit', 'spend_wallet',
        'spend_wallet_on_ppv', 'spend_wallet_on_tip',
        'spend_wallet_on_subscription', 'settle_matured_earnings',
        'reverse_consumption_order', 'refund_unspent_balance',
        'reconciliation_report', 'revenue_report', 'nexus_report',
        'increment_wallet_available', 'request_withdrawal',
        'decide_withdrawal', 'recharge_wallet', 'unlock_ppv',
        'rpc_purchase_post'
      ])
  LOOP
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON FUNCTION %s FROM PUBLIC, anon, authenticated',
      v_proc.signature
    );
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION %s TO service_role',
      v_proc.signature
    );
  END LOOP;
END;
$$;

-- Migration-time assertions: fail deployment instead of silently leaving a
-- browser role with access to any protected financial RPC.
DO $$
DECLARE
  v_proc record;
BEGIN
  FOR v_proc IN
    SELECT p.oid, p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY (ARRAY[
        'open_payment_order', 'credit_payram_deposit',
        'credit_nowpayments_deposit', 'spend_wallet',
        'spend_wallet_on_ppv', 'spend_wallet_on_tip',
        'spend_wallet_on_subscription', 'settle_matured_earnings',
        'reverse_consumption_order', 'refund_unspent_balance',
        'reconciliation_report', 'revenue_report', 'nexus_report',
        'increment_wallet_available', 'request_withdrawal',
        'decide_withdrawal', 'recharge_wallet', 'unlock_ppv',
        'rpc_purchase_post'
      ])
  LOOP
    IF has_function_privilege('anon', v_proc.oid, 'EXECUTE')
       OR has_function_privilege('authenticated', v_proc.oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'financial RPC remains browser-callable: %', v_proc.signature;
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_profile_privileged_fields() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.protect_profile_privileged_fields() TO service_role;
