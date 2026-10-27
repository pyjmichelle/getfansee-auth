-- 064: Contain mixed-wallet cash-out risk. Personal funded balance is never
-- creator revenue; requests and the creator UI cap payouts to settled earned
-- ledger liability. This does not split personal spending and earnings wallets.
-- Conservatively deduct all unreversed personal purchases from eligible earned
-- available balance. Even a deposit-funded purchase reduces this cap: without
-- separate accounts there is no safe way to infer which money was spent.
-- Pending balances show unmatured earnings; the deduction applies at maturity.
-- The historical reconciliation identity still needs a separate account model
-- before unrestricted mixed creator/fan activity is enabled in production.

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
  v_earned BIGINT;
  v_personal_spend BIGINT;
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
  PERFORM pg_advisory_xact_lock(hashtextextended('withdrawal-key:' || p_idempotency_key, 0));

  SELECT * INTO v_existing
  FROM public.withdrawal_requests
  WHERE idempotency_key = p_idempotency_key;

  IF FOUND THEN
    IF v_existing.creator_id IS DISTINCT FROM p_creator_id
       OR v_existing.method_id IS DISTINCT FROM p_method_id
       OR v_existing.amount_cents IS DISTINCT FROM p_amount_cents THEN
      RETURN json_build_object('success', false, 'error', 'Idempotency key conflicts with another withdrawal');
    END IF;
    RETURN json_build_object(
      'success', true, 'idempotent', true,
      'request_id', v_existing.id,
      'status', v_existing.status,
      'amount_cents', v_existing.amount_cents
    );
  END IF;

  PERFORM 1 FROM public.profiles WHERE id = p_creator_id AND role = 'creator';
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Creator not found');
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

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient balance', 'balance_cents', 0);
  END IF;

  -- Wallet balance can include personal top-ups. Only earned, settled ledger
  -- liability is withdrawable. Include negative payout/adjustment entries so
  -- prior withdrawals and refund debt cannot be funded again by a top-up.
  SELECT COALESCE(SUM(amount_cents), 0) INTO v_earned
  FROM public.creator_ledger WHERE creator_id = p_creator_id AND state = 'available';
  -- Until accounts are split, conservatively assume personal purchases spent
  -- earnings first. A later personal deposit cannot restore cash-out rights.
  -- Deposit-funded purchases may therefore reduce legitimate earnings too;
  -- that intentional conservative restriction ends with separate accounts.
  SELECT COALESCE(SUM(gross_amount_cents), 0) INTO v_personal_spend
  FROM public.consumption_orders WHERE fan_id = p_creator_id AND reversed_at IS NULL;
  v_earned := v_earned - v_personal_spend;
  v_balance := GREATEST(0, LEAST(v_balance, v_earned));
  IF v_balance < p_amount_cents THEN
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
    'balance_cents', GREATEST(0, LEAST(v_balance, v_earned - p_amount_cents)),
    'amount_cents', p_amount_cents,
    'status', 'requested'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.creator_earned_balances(p_creator_id UUID)
RETURNS JSON
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'available_cents', GREATEST(0, LEAST(COALESCE(wa.available_balance_cents, 0),
      COALESCE((SELECT SUM(amount_cents) FROM public.creator_ledger
                WHERE creator_id = p_creator_id AND state = 'available'), 0)
      - COALESCE((SELECT SUM(gross_amount_cents) FROM public.consumption_orders
                  WHERE fan_id = p_creator_id AND reversed_at IS NULL), 0))),
    'pending_cents', GREATEST(0, LEAST(COALESCE(wa.pending_balance_cents, 0),
      COALESCE((SELECT SUM(amount_cents) FROM public.creator_ledger
                WHERE creator_id = p_creator_id AND state = 'pending'), 0)))
  ) FROM (SELECT p_creator_id AS id) owner
  LEFT JOIN public.wallet_accounts wa ON wa.user_id = owner.id
$$;

REVOKE ALL ON FUNCTION public.request_withdrawal(UUID, UUID, BIGINT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_withdrawal(UUID, UUID, BIGINT, TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.creator_earned_balances(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.creator_earned_balances(UUID) TO service_role;
