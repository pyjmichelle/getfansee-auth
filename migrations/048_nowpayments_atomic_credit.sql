-- Migration 048: Atomic, idempotent NowPayments deposit crediting
--
-- Fixes three compounding defects found in the 2026-07-26 UI/finance audit
-- of app/api/webhooks/nowpayments/route.ts:
--
--   1. Idempotency was keyed on `payment_id + payment_status`. NowPayments
--      sends BOTH "confirmed" and "finished" as final statuses for the same
--      payment, so two IPNs for one payment could each pass the dedupe
--      check and race to insert a completed deposit transaction (TOCTOU:
--      SELECT existing tx -> both see none -> both INSERT).
--   2. The `webhook_events` row was marked status='processed' BEFORE the
--      wallet was actually credited. If the transaction insert or wallet
--      upsert failed after that point (transient DB error), NowPayments'
--      retry would be rejected as a duplicate at the very first check —
--      permanently losing the deposit even though the user paid.
--   3. wallet_accounts balance was updated via an application-level
--      read-then-upsert (two round trips), which loses updates under
--      concurrent IPNs for different payments to the same user.
--
-- Fix: a single SECURITY DEFINER function that (a) does the wallet balance
-- increment as one atomic UPSERT statement, and (b) relies on a Postgres
-- UNIQUE index on the payment_id (not payment_id+status) as the ONE source
-- of truth for "have we already credited this payment", enforced by the
-- database itself rather than a racy SELECT-then-INSERT in application code.

-- ── 1. Unique index: at most one completed NowPayments deposit per payment_id ──
-- Scoped by nowpayments_payment_id alone (not status) so "confirmed" and
-- "finished" IPNs for the same payment collapse onto the same guard.
CREATE UNIQUE INDEX IF NOT EXISTS uq_transactions_nowpayments_payment_id
ON public.transactions (
  (metadata->>'nowpayments_payment_id')
)
WHERE type = 'deposit'
  AND status = 'completed'
  AND metadata ? 'nowpayments_payment_id'
  AND metadata->>'nowpayments_payment_id' IS NOT NULL;

-- ── 2. Atomic credit function (service-role only; no auth.uid() binding — ──
--       called from the webhook handler on behalf of the paying user, who
--       has no active session at IPN time) ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.credit_nowpayments_deposit(
  p_user_id UUID,
  p_amount_cents INTEGER,
  p_payment_id TEXT,
  p_pay_currency TEXT,
  p_payment_status TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance BIGINT;
BEGIN
  IF p_amount_cents IS NULL OR p_amount_cents <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Invalid amount');
  END IF;
  IF p_payment_id IS NULL OR p_payment_id = '' THEN
    RETURN json_build_object('success', false, 'error', 'Missing payment_id');
  END IF;

  -- Atomic wallet increment — single statement, no read-then-write race.
  INSERT INTO public.wallet_accounts (user_id, available_balance_cents, pending_balance_cents)
  VALUES (p_user_id, p_amount_cents, 0)
  ON CONFLICT (user_id) DO UPDATE
    SET available_balance_cents = wallet_accounts.available_balance_cents + EXCLUDED.available_balance_cents,
        updated_at = timezone('utc', now())
  RETURNING available_balance_cents INTO v_new_balance;

  -- Record the deposit. The unique index above is the actual concurrency
  -- guard: if two IPNs (e.g. confirmed + finished) for the same payment_id
  -- race here, only one INSERT succeeds — the loser hits unique_violation
  -- and unwinds the wallet credit it just applied above.
  BEGIN
    INSERT INTO public.transactions (user_id, type, amount_cents, status, metadata)
    VALUES (
      p_user_id,
      'deposit',
      p_amount_cents,
      'completed',
      jsonb_build_object(
        'payment_method', 'nowpayments',
        'nowpayments_payment_id', p_payment_id,
        'pay_currency', p_pay_currency,
        'payment_status', p_payment_status
      )
    );
  EXCEPTION WHEN unique_violation THEN
    UPDATE public.wallet_accounts
      SET available_balance_cents = available_balance_cents - p_amount_cents,
          updated_at = timezone('utc', now())
      WHERE user_id = p_user_id
      RETURNING available_balance_cents INTO v_new_balance;

    RETURN json_build_object(
      'success', true,
      'balance_cents', v_new_balance,
      'idempotent', true
    );
  END;

  RETURN json_build_object(
    'success', true,
    'balance_cents', v_new_balance,
    'idempotent', false
  );
END;
$$;

-- Only the server (service role, via the webhook handler after HMAC
-- signature verification) may call this — never exposed to `authenticated`.
REVOKE ALL ON FUNCTION public.credit_nowpayments_deposit(UUID, INTEGER, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.credit_nowpayments_deposit(UUID, INTEGER, TEXT, TEXT, TEXT) TO service_role;

-- ── 3. Verification ──────────────────────────────────────────────────────
DO $$
DECLARE
  v_index_exists boolean;
  v_function_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'uq_transactions_nowpayments_payment_id'
  ) INTO v_index_exists;

  SELECT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'credit_nowpayments_deposit'
  ) INTO v_function_exists;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration 048 Verification:';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'uq_transactions_nowpayments_payment_id exists: %', v_index_exists;
  RAISE NOTICE 'credit_nowpayments_deposit function exists: %', v_function_exists;
  RAISE NOTICE '========================================';
END $$;
