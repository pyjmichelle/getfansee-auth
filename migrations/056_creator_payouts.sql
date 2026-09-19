-- Migration 056: Creator self-serve withdrawals
--
-- 051 created payout_batches and a 'payout' ledger type but never wrote either.
-- settle_matured_earnings only moves pending → available. This migration is the
-- missing money-out path: a creator requests a withdrawal against available
-- balance, the wallet is debited immediately (so two requests cannot overdraw),
-- and an admin later marks the off-platform transfer paid or rejects it.
--
-- Accounting: a request inserts a negative `payout` ledger row in `available`
-- and debits `wallet_accounts.available_balance_cents`. Identity #3
-- (creator_ledger_matches_wallets) stays balanced because both sides move.
-- Approving attaches a payout_batch and MUST leave the ledger row in
-- `available` — flipping it to `paid` would drop it from the identity sum
-- while the wallet stays reduced, permanently breaking reconciliation.
-- Rejecting voids the ledger row and credits the wallet back.
--
-- Also reapplies PayRam asset/network normalisation (added to 051 after that
-- migration had already been applied live) and an atomic wallet increment
-- used by the test-only mock recharge path.
--
-- Depends on: 051, 052

-- ── 0. PayRam aliases (live re-apply of the 051 hardening) ──────────────────
CREATE OR REPLACE FUNCTION public.normalize_payram_asset(p_value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE replace(replace(upper(trim(COALESCE(p_value, ''))), '-', ''), '_', '')
    WHEN 'USDCOIN' THEN 'USDC'
    WHEN 'USDC' THEN 'USDC'
    ELSE replace(replace(upper(trim(COALESCE(p_value, ''))), '-', ''), '_', '')
  END
$$;

CREATE OR REPLACE FUNCTION public.normalize_payram_network(p_value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE replace(replace(upper(trim(COALESCE(p_value, ''))), '-', ''), '_', '')
    WHEN 'BASEMAINNET' THEN 'BASE'
    WHEN 'BASE' THEN 'BASE'
    ELSE replace(replace(upper(trim(COALESCE(p_value, ''))), '-', ''), '_', '')
  END
$$;

-- Live 051 already applied the un-normalised match. Re-replace so existing
-- databases pick up the alias-tolerant comparison without re-running 051.
CREATE OR REPLACE FUNCTION public.credit_payram_deposit(
  p_reference_id  TEXT,
  p_filled_cents  BIGINT,
  p_state         TEXT,
  p_currency      TEXT DEFAULT NULL,
  p_network       TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order        public.payment_orders%ROWTYPE;
  v_new_balance  BIGINT;
BEGIN
  IF p_reference_id IS NULL OR p_reference_id = '' THEN
    RETURN json_build_object('success', false, 'error', 'Missing reference_id');
  END IF;

  SELECT * INTO v_order
  FROM public.payment_orders
  WHERE provider = 'payram' AND reference_id = p_reference_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Unknown order');
  END IF;

  IF p_currency IS NOT NULL
     AND public.normalize_payram_asset(p_currency)
         <> public.normalize_payram_asset(v_order.currency) THEN
    RETURN json_build_object('success', false, 'error', 'Currency mismatch');
  END IF;
  IF p_network IS NOT NULL
     AND public.normalize_payram_network(p_network)
         <> public.normalize_payram_network(v_order.network) THEN
    RETURN json_build_object('success', false, 'error', 'Network mismatch');
  END IF;

  IF v_order.credited_at IS NOT NULL THEN
    SELECT available_balance_cents INTO v_new_balance
    FROM public.wallet_accounts WHERE user_id = v_order.user_id;
    RETURN json_build_object(
      'success', true, 'idempotent', true,
      'order_id', v_order.id, 'balance_cents', COALESCE(v_new_balance, 0)
    );
  END IF;

  IF p_state NOT IN ('FILLED', 'OVER_FILLED') THEN
    UPDATE public.payment_orders
      SET state = p_state,
          filled_usd_cents = GREATEST(filled_usd_cents, COALESCE(p_filled_cents, 0)),
          updated_at = timezone('utc', now())
      WHERE id = v_order.id;
    RETURN json_build_object(
      'success', true, 'credited', false, 'order_id', v_order.id,
      'reason', 'non_terminal_state'
    );
  END IF;

  IF p_filled_cents IS NULL OR p_filled_cents <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Invalid filled amount');
  END IF;

  INSERT INTO public.wallet_accounts (user_id, available_balance_cents, pending_balance_cents)
  VALUES (v_order.user_id, p_filled_cents, 0)
  ON CONFLICT (user_id) DO UPDATE
    SET available_balance_cents = public.wallet_accounts.available_balance_cents + EXCLUDED.available_balance_cents,
        updated_at = timezone('utc', now())
  RETURNING available_balance_cents INTO v_new_balance;

  UPDATE public.payment_orders
    SET state = p_state,
        filled_usd_cents = p_filled_cents,
        credited_cents = p_filled_cents,
        credited_at = timezone('utc', now()),
        updated_at = timezone('utc', now())
    WHERE id = v_order.id;

  INSERT INTO public.transactions (user_id, type, amount_cents, status, metadata)
  VALUES (
    v_order.user_id, 'deposit', p_filled_cents, 'completed',
    jsonb_build_object(
      'payment_method', 'payram',
      'payram_reference_id', p_reference_id,
      'payment_order_id', v_order.id,
      'currency', v_order.currency,
      'network', v_order.network,
      'state', p_state
    )
  );

  RETURN json_build_object(
    'success', true, 'credited', true, 'idempotent', false,
    'order_id', v_order.id, 'balance_cents', v_new_balance
  );
END;
$$;

-- ── 1. creator_payout_methods ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.creator_payout_methods (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rail         text NOT NULL CHECK (rail IN ('payram_crypto', 'paxum')),
  destination  text NOT NULL,
  label        text,
  is_default   boolean NOT NULL DEFAULT false,
  verified_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at   timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_creator_payout_methods_creator
  ON public.creator_payout_methods (creator_id, created_at DESC);

ALTER TABLE public.creator_payout_methods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "creator_payout_methods_select_own" ON public.creator_payout_methods;
CREATE POLICY "creator_payout_methods_select_own"
  ON public.creator_payout_methods FOR SELECT
  USING (auth.uid() = creator_id);

-- ── 2. withdrawal_requests ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_cents         bigint NOT NULL CHECK (amount_cents > 0),
  fee_cents            bigint NOT NULL DEFAULT 0 CHECK (fee_cents >= 0),
  net_cents            bigint NOT NULL CHECK (net_cents >= 0),
  method_id            uuid NOT NULL REFERENCES public.creator_payout_methods(id),
  status               text NOT NULL DEFAULT 'requested'
                         CHECK (status IN ('requested', 'paid', 'rejected', 'cancelled')),
  creator_ledger_id    uuid REFERENCES public.creator_ledger(id) ON DELETE SET NULL,
  payout_batch_id      uuid REFERENCES public.payout_batches(id) ON DELETE SET NULL,
  external_reference   text,
  reason               text,
  decided_by           uuid REFERENCES auth.users(id),
  decided_at           timestamptz,
  idempotency_key      text NOT NULL UNIQUE,
  created_at           timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at           timestamptz NOT NULL DEFAULT timezone('utc', now()),

  CONSTRAINT withdrawal_requests_split_balances
    CHECK (fee_cents + net_cents = amount_cents)
);

CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_creator
  ON public.withdrawal_requests (creator_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status
  ON public.withdrawal_requests (status, created_at DESC)
  WHERE status = 'requested';

ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "withdrawal_requests_select_own" ON public.withdrawal_requests;
CREATE POLICY "withdrawal_requests_select_own"
  ON public.withdrawal_requests FOR SELECT
  USING (auth.uid() = creator_id);

-- ── 3. increment_wallet_available — atomic mock-recharge increment ──────────
CREATE OR REPLACE FUNCTION public.increment_wallet_available(
  p_user_id UUID,
  p_cents   BIGINT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance BIGINT;
BEGIN
  IF p_cents IS NULL OR p_cents = 0 THEN
    RETURN json_build_object('success', false, 'error', 'Invalid amount');
  END IF;

  INSERT INTO public.wallet_accounts (user_id, available_balance_cents, pending_balance_cents)
  VALUES (p_user_id, p_cents, 0)
  ON CONFLICT (user_id) DO UPDATE
    SET available_balance_cents = public.wallet_accounts.available_balance_cents + EXCLUDED.available_balance_cents,
        updated_at = timezone('utc', now())
  RETURNING available_balance_cents INTO v_balance;

  RETURN json_build_object('success', true, 'balance_cents', v_balance);
END;
$$;

-- ── 4. request_withdrawal ───────────────────────────────────────────────────
-- Must stay in lockstep with lib/constants/fees.ts MINIMUM_PAYOUT_CENTS = 2000.
CREATE OR REPLACE FUNCTION public.request_withdrawal(
  p_creator_id       UUID,
  p_method_id        UUID,
  p_amount_cents     BIGINT,
  p_idempotency_key  TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_method     public.creator_payout_methods%ROWTYPE;
  v_existing   public.withdrawal_requests%ROWTYPE;
  v_balance    BIGINT;
  v_ledger_id  UUID;
  v_request_id UUID;
BEGIN
  IF p_amount_cents IS NULL OR p_amount_cents < 2000 THEN
    RETURN json_build_object('success', false, 'error', 'Below minimum payout');
  END IF;
  IF p_idempotency_key IS NULL OR p_idempotency_key = '' THEN
    RETURN json_build_object('success', false, 'error', 'Missing idempotency key');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('withdrawal:' || p_creator_id::text, 0));

  SELECT * INTO v_existing
  FROM public.withdrawal_requests
  WHERE idempotency_key = p_idempotency_key;

  IF FOUND THEN
    RETURN json_build_object(
      'success', true, 'idempotent', true,
      'request_id', v_existing.id,
      'status', v_existing.status,
      'amount_cents', v_existing.amount_cents
    );
  END IF;

  SELECT * INTO v_method
  FROM public.creator_payout_methods
  WHERE id = p_method_id AND creator_id = p_creator_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Unknown payout method');
  END IF;

  SELECT available_balance_cents INTO v_balance
  FROM public.wallet_accounts
  WHERE user_id = p_creator_id
  FOR UPDATE;

  IF NOT FOUND OR COALESCE(v_balance, 0) < p_amount_cents THEN
    RETURN json_build_object(
      'success', false, 'error', 'Insufficient balance',
      'balance_cents', COALESCE(v_balance, 0)
    );
  END IF;

  UPDATE public.wallet_accounts
    SET available_balance_cents = available_balance_cents - p_amount_cents,
        updated_at = timezone('utc', now())
    WHERE user_id = p_creator_id
    RETURNING available_balance_cents INTO v_balance;

  INSERT INTO public.creator_ledger (
    creator_id, entry_type, amount_cents, state, idempotency_key, note
  )
  VALUES (
    p_creator_id, 'payout', -p_amount_cents, 'available',
    'payout_' || p_idempotency_key,
    'Withdrawal request'
  )
  RETURNING id INTO v_ledger_id;

  INSERT INTO public.withdrawal_requests (
    creator_id, amount_cents, fee_cents, net_cents, method_id,
    status, creator_ledger_id, idempotency_key
  )
  VALUES (
    p_creator_id, p_amount_cents, 0, p_amount_cents, p_method_id,
    'requested', v_ledger_id, p_idempotency_key
  )
  RETURNING id INTO v_request_id;

  INSERT INTO public.transactions (user_id, type, amount_cents, status, metadata)
  VALUES (
    p_creator_id, 'withdrawal', -p_amount_cents, 'pending',
    jsonb_build_object(
      'withdrawal_request_id', v_request_id,
      'method_id', p_method_id,
      'rail', v_method.rail,
      'idempotency_key', p_idempotency_key
    )
  );

  RETURN json_build_object(
    'success', true, 'idempotent', false,
    'request_id', v_request_id,
    'ledger_id', v_ledger_id,
    'balance_cents', v_balance,
    'amount_cents', p_amount_cents,
    'status', 'requested'
  );
END;
$$;

-- ── 5. decide_withdrawal ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.decide_withdrawal(
  p_request_id          UUID,
  p_decision            TEXT,
  p_external_reference  TEXT,
  p_reason              TEXT,
  p_admin_id            UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request  public.withdrawal_requests%ROWTYPE;
  v_method   public.creator_payout_methods%ROWTYPE;
  v_batch_id UUID;
  v_balance  BIGINT;
BEGIN
  IF p_decision NOT IN ('paid', 'rejected') THEN
    RETURN json_build_object('success', false, 'error', 'Invalid decision');
  END IF;

  SELECT * INTO v_request
  FROM public.withdrawal_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Unknown withdrawal');
  END IF;

  IF v_request.status <> 'requested' THEN
    RETURN json_build_object(
      'success', true, 'idempotent', true,
      'request_id', v_request.id,
      'status', v_request.status
    );
  END IF;

  IF p_decision = 'paid' THEN
    IF p_external_reference IS NULL OR p_external_reference = '' THEN
      RETURN json_build_object('success', false, 'error', 'Missing external reference');
    END IF;

    SELECT * INTO v_method FROM public.creator_payout_methods WHERE id = v_request.method_id;

    INSERT INTO public.payout_batches (
      period_start, period_end, status, rail, total_cents, creator_count,
      external_reference, notes, approved_at, paid_at
    )
    VALUES (
      v_request.created_at,
      GREATEST(v_request.created_at + interval '1 second', timezone('utc', now())),
      'paid',
      COALESCE(v_method.rail, 'paxum'),
      v_request.amount_cents,
      1,
      p_external_reference,
      p_reason,
      timezone('utc', now()),
      timezone('utc', now())
    )
    RETURNING id INTO v_batch_id;

    -- Keep the payout ledger row in `available`. See file header.
    UPDATE public.creator_ledger
      SET payout_batch_id = v_batch_id,
          note = 'Withdrawal paid: ' || p_external_reference,
          updated_at = timezone('utc', now())
      WHERE id = v_request.creator_ledger_id;

    UPDATE public.withdrawal_requests
      SET status = 'paid',
          payout_batch_id = v_batch_id,
          external_reference = p_external_reference,
          reason = p_reason,
          decided_by = p_admin_id,
          decided_at = timezone('utc', now()),
          updated_at = timezone('utc', now())
      WHERE id = v_request.id;

    UPDATE public.transactions
      SET status = 'completed',
          updated_at = timezone('utc', now())
      WHERE type = 'withdrawal'
        AND metadata->>'withdrawal_request_id' = v_request.id::text;

    RETURN json_build_object(
      'success', true, 'idempotent', false,
      'request_id', v_request.id,
      'status', 'paid',
      'payout_batch_id', v_batch_id
    );
  END IF;

  -- rejected: put the money back and drop the ledger row from identity #3
  UPDATE public.wallet_accounts
    SET available_balance_cents = available_balance_cents + v_request.amount_cents,
        updated_at = timezone('utc', now())
    WHERE user_id = v_request.creator_id
    RETURNING available_balance_cents INTO v_balance;

  UPDATE public.creator_ledger
    SET state = 'void',
        note = 'Withdrawal rejected: ' || COALESCE(p_reason, 'no reason given'),
        updated_at = timezone('utc', now())
    WHERE id = v_request.creator_ledger_id;

  UPDATE public.withdrawal_requests
    SET status = 'rejected',
        reason = p_reason,
        decided_by = p_admin_id,
        decided_at = timezone('utc', now()),
        updated_at = timezone('utc', now())
    WHERE id = v_request.id;

  UPDATE public.transactions
    SET status = 'failed',
        updated_at = timezone('utc', now())
    WHERE type = 'withdrawal'
      AND metadata->>'withdrawal_request_id' = v_request.id::text;

  RETURN json_build_object(
    'success', true, 'idempotent', false,
    'request_id', v_request.id,
    'status', 'rejected',
    'balance_cents', v_balance
  );
END;
$$;

-- ── 6. Reconciliation identity #5 ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reconciliation_report()
RETURNS TABLE (
  identity     TEXT,
  left_cents   BIGINT,
  right_cents  BIGINT,
  difference   BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    'credited_deposits_match_orders'::text,
    COALESCE((SELECT SUM(amount_cents) FROM public.transactions
              WHERE type = 'deposit' AND status = 'completed'
                AND metadata->>'payment_method' = 'payram'), 0)::bigint,
    COALESCE((SELECT SUM(credited_cents) FROM public.payment_orders
              WHERE credited_at IS NOT NULL), 0)::bigint,
    COALESCE((SELECT SUM(amount_cents) FROM public.transactions
              WHERE type = 'deposit' AND status = 'completed'
                AND metadata->>'payment_method' = 'payram'), 0)::bigint
      - COALESCE((SELECT SUM(credited_cents) FROM public.payment_orders
                  WHERE credited_at IS NOT NULL), 0)::bigint

  UNION ALL

  SELECT
    'consumption_splits_balance'::text,
    COALESCE((SELECT SUM(gross_amount_cents) FROM public.consumption_orders
              WHERE reversed_at IS NULL), 0)::bigint,
    COALESCE((SELECT SUM(platform_fee_cents + creator_net_cents) FROM public.consumption_orders
              WHERE reversed_at IS NULL), 0)::bigint,
    COALESCE((SELECT SUM(gross_amount_cents - platform_fee_cents - creator_net_cents)
              FROM public.consumption_orders WHERE reversed_at IS NULL), 0)::bigint

  UNION ALL

  SELECT
    'creator_ledger_matches_wallets'::text,
    COALESCE((SELECT SUM(amount_cents) FROM public.creator_ledger
              WHERE state IN ('pending', 'available')), 0)::bigint,
    COALESCE((SELECT SUM(wa.pending_balance_cents + wa.available_balance_cents)
              FROM public.wallet_accounts wa
              JOIN public.profiles p ON p.id = wa.user_id
              WHERE p.role = 'creator'), 0)::bigint,
    COALESCE((SELECT SUM(amount_cents) FROM public.creator_ledger
              WHERE state IN ('pending', 'available')), 0)::bigint
      - COALESCE((SELECT SUM(wa.pending_balance_cents + wa.available_balance_cents)
                  FROM public.wallet_accounts wa
                  JOIN public.profiles p ON p.id = wa.user_id
                  WHERE p.role = 'creator'), 0)::bigint

  UNION ALL

  SELECT
    'fan_liability_matches_balances'::text,
    (COALESCE((SELECT SUM(credited_cents) FROM public.payment_orders WHERE credited_at IS NOT NULL), 0)
     - COALESCE((SELECT SUM(gross_amount_cents) FROM public.consumption_orders WHERE reversed_at IS NULL), 0)
     - COALESCE((SELECT SUM(-amount_cents) FROM public.transactions
                 WHERE type = 'refund' AND amount_cents < 0), 0))::bigint,
    COALESCE((SELECT SUM(wa.available_balance_cents)
              FROM public.wallet_accounts wa
              JOIN public.profiles p ON p.id = wa.user_id
              WHERE p.role <> 'creator'), 0)::bigint,
    (COALESCE((SELECT SUM(credited_cents) FROM public.payment_orders WHERE credited_at IS NOT NULL), 0)
     - COALESCE((SELECT SUM(gross_amount_cents) FROM public.consumption_orders WHERE reversed_at IS NULL), 0)
     - COALESCE((SELECT SUM(-amount_cents) FROM public.transactions
                 WHERE type = 'refund' AND amount_cents < 0), 0)
     - COALESCE((SELECT SUM(wa.available_balance_cents)
                 FROM public.wallet_accounts wa
                 JOIN public.profiles p ON p.id = wa.user_id
                 WHERE p.role <> 'creator'), 0))::bigint

  UNION ALL

  -- Paid withdrawals must equal the payout ledger rows attached to a batch.
  SELECT
    'payouts_match_ledger'::text,
    COALESCE((SELECT SUM(amount_cents) FROM public.withdrawal_requests
              WHERE status = 'paid'), 0)::bigint,
    COALESCE((SELECT SUM(-amount_cents) FROM public.creator_ledger
              WHERE entry_type = 'payout' AND payout_batch_id IS NOT NULL), 0)::bigint,
    COALESCE((SELECT SUM(amount_cents) FROM public.withdrawal_requests
              WHERE status = 'paid'), 0)::bigint
      - COALESCE((SELECT SUM(-amount_cents) FROM public.creator_ledger
                  WHERE entry_type = 'payout' AND payout_batch_id IS NOT NULL), 0)::bigint;
$$;

-- ── 7. Permissions ──────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.credit_payram_deposit(TEXT, BIGINT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.credit_payram_deposit(TEXT, BIGINT, TEXT, TEXT, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.normalize_payram_asset(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.normalize_payram_asset(TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.normalize_payram_network(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.normalize_payram_network(TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.increment_wallet_available(UUID, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_wallet_available(UUID, BIGINT) TO service_role;

REVOKE ALL ON FUNCTION public.request_withdrawal(UUID, UUID, BIGINT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_withdrawal(UUID, UUID, BIGINT, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.decide_withdrawal(UUID, TEXT, TEXT, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decide_withdrawal(UUID, TEXT, TEXT, TEXT, UUID) TO service_role;

REVOKE ALL ON FUNCTION public.reconciliation_report() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reconciliation_report() TO service_role;

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration 056 Verification:';
  RAISE NOTICE 'creator_payout_methods: %', (SELECT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='creator_payout_methods'));
  RAISE NOTICE 'withdrawal_requests:    %', (SELECT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='withdrawal_requests'));
  RAISE NOTICE 'request_withdrawal:     %', (SELECT EXISTS (SELECT 1 FROM pg_proc WHERE proname='request_withdrawal'));
  RAISE NOTICE 'decide_withdrawal:      %', (SELECT EXISTS (SELECT 1 FROM pg_proc WHERE proname='decide_withdrawal'));
  RAISE NOTICE '========================================';
END $$;
