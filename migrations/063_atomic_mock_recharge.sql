-- Service-role-only mock funding. Application runtime also refuses hosted production.
CREATE OR REPLACE FUNCTION public.recharge_wallet(
  p_user_id UUID, p_amount_cents INTEGER, p_idempotency_key TEXT DEFAULT NULL
) RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tx public.transactions%ROWTYPE;
  v_balance BIGINT;
BEGIN
  IF p_amount_cents IS NULL OR p_amount_cents < 1 OR p_amount_cents > 50000
     OR p_idempotency_key IS NULL OR length(p_idempotency_key) = 0 THEN
    RETURN json_build_object('success', false, 'error', 'Invalid recharge intent');
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('mock-recharge:' || p_user_id::text, 0));
  SELECT * INTO v_tx FROM public.transactions
    WHERE metadata->>'idempotency_key' = p_idempotency_key LIMIT 1;
  IF FOUND THEN
    IF v_tx.user_id IS DISTINCT FROM p_user_id OR v_tx.amount_cents IS DISTINCT FROM p_amount_cents
       OR v_tx.type <> 'deposit' OR v_tx.status <> 'completed'
       OR v_tx.metadata->>'payment_method' IS DISTINCT FROM 'mock' THEN
      RETURN json_build_object('success', false, 'error', 'Idempotency key conflict');
    END IF;
    SELECT available_balance_cents INTO v_balance FROM public.wallet_accounts WHERE user_id = p_user_id;
    RETURN json_build_object('success', true, 'idempotent', true, 'balance_cents', COALESCE(v_balance, 0));
  END IF;
  INSERT INTO public.wallet_accounts (user_id, available_balance_cents, pending_balance_cents)
    VALUES (p_user_id, p_amount_cents, 0)
    ON CONFLICT (user_id) DO UPDATE
      SET available_balance_cents = wallet_accounts.available_balance_cents + EXCLUDED.available_balance_cents,
          updated_at = timezone('utc', now())
    RETURNING available_balance_cents INTO v_balance;
  INSERT INTO public.transactions (user_id, type, amount_cents, status, metadata)
    VALUES (p_user_id, 'deposit', p_amount_cents, 'completed',
      jsonb_build_object('payment_method', 'mock', 'idempotency_key', p_idempotency_key));
  RETURN json_build_object('success', true, 'idempotent', false, 'balance_cents', v_balance);
END;
$$;
REVOKE ALL ON FUNCTION public.recharge_wallet(UUID, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recharge_wallet(UUID, INTEGER, TEXT) TO service_role;
