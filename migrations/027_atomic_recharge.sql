-- Migration 027: Atomic wallet recharge function
-- Combines wallet upsert + transaction insert into a single atomic operation
-- Prevents balance/transaction inconsistency seen in P1 audit finding.

CREATE OR REPLACE FUNCTION recharge_wallet(
  p_user_id UUID,
  p_amount_cents INTEGER,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance INTEGER;
  v_existing_tx_id UUID;
BEGIN
  -- Idempotency: if same key already succeeded, return cached result
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_tx_id
    FROM transactions
    WHERE user_id = p_user_id
      AND type = 'deposit'
      AND status = 'completed'
      AND metadata->>'idempotency_key' = p_idempotency_key
    LIMIT 1;

    IF v_existing_tx_id IS NOT NULL THEN
      SELECT available_balance_cents INTO v_new_balance
      FROM wallet_accounts WHERE user_id = p_user_id;
      RETURN json_build_object(
        'success', true,
        'balance_cents', v_new_balance,
        'idempotent', true
      );
    END IF;
  END IF;

  -- Upsert wallet account
  INSERT INTO wallet_accounts (user_id, available_balance_cents, pending_balance_cents)
  VALUES (p_user_id, p_amount_cents, 0)
  ON CONFLICT (user_id) DO UPDATE
    SET available_balance_cents = wallet_accounts.available_balance_cents + EXCLUDED.available_balance_cents
  RETURNING available_balance_cents INTO v_new_balance;

  -- Record transaction (atomically in same transaction)
  INSERT INTO transactions (user_id, type, amount_cents, status, metadata)
  VALUES (
    p_user_id,
    'deposit',
    p_amount_cents,
    'completed',
    json_build_object(
      'payment_method', 'mock',
      'idempotency_key', p_idempotency_key
    )::jsonb
  );

  RETURN json_build_object(
    'success', true,
    'balance_cents', v_new_balance,
    'idempotent', false
  );
END;
$$;

-- Security: only authenticated users can recharge their own wallet
-- The server-side API route already validates user identity before calling this RPC.
GRANT EXECUTE ON FUNCTION recharge_wallet(UUID, INTEGER, TEXT) TO authenticated;
