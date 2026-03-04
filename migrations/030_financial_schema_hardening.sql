-- Migration 030: Financial schema hardening and cents-model unification
-- Goals:
-- 1) Normalize transaction type constraint to include current money flows
-- 2) Ensure purchases idempotency column/index exist
-- 3) Replace unlock_ppv with cents-based, auth-safe implementation
-- 4) Replace recharge_wallet with caller validation and stronger idempotency handling

-- --------------------------------------------
-- 0. Preconditions / compatibility columns
-- --------------------------------------------
ALTER TABLE public.purchases
ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'purchases_idempotency_key_key'
  ) THEN
    ALTER TABLE public.purchases
    ADD CONSTRAINT purchases_idempotency_key_key UNIQUE (idempotency_key);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_purchases_idempotency_key
ON public.purchases(idempotency_key);

-- --------------------------------------------
-- 1. Transactions type constraint normalization
-- --------------------------------------------
ALTER TABLE public.transactions
DROP CONSTRAINT IF EXISTS transactions_type_check;

ALTER TABLE public.transactions
ADD CONSTRAINT transactions_type_check
CHECK (
  type IN (
    'deposit',
    'withdrawal',
    'subscription',
    'ppv_purchase',
    'ppv_unlock',
    'ppv_revenue',
    'commission',
    'payout'
  )
);

-- Recharge idempotency unique guard:
-- Prevents duplicate successful deposit transaction inserts under concurrent retries.
CREATE UNIQUE INDEX IF NOT EXISTS uq_transactions_deposit_idempotency
ON public.transactions (
  user_id,
  (metadata->>'idempotency_key')
)
WHERE type = 'deposit'
  AND status = 'completed'
  AND metadata ? 'idempotency_key'
  AND metadata->>'idempotency_key' IS NOT NULL;

-- --------------------------------------------
-- 2. unlock_ppv (cents model + auth binding)
-- --------------------------------------------
CREATE OR REPLACE FUNCTION public.unlock_ppv(
  p_post_id UUID,
  p_user_id UUID,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post RECORD;
  v_existing_purchase UUID;
  v_purchase_id UUID;
  v_fan_balance BIGINT;
  v_price_cents BIGINT;
  v_computed_idempotency_key TEXT;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized: caller identity mismatch'
    );
  END IF;

  SELECT p.id, p.creator_id, p.price_cents, p.visibility, p.title
  INTO v_post
  FROM public.posts p
  WHERE p.id = p_post_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Post not found');
  END IF;

  v_price_cents := COALESCE(v_post.price_cents, 0);
  IF v_price_cents <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Post is not a payable PPV post');
  END IF;

  v_computed_idempotency_key := COALESCE(
    NULLIF(p_idempotency_key, ''),
    'unlock_' || p_post_id::text || '_' || p_user_id::text || '_' || EXTRACT(EPOCH FROM NOW())::text
  );

  -- Idempotency by key
  SELECT id INTO v_existing_purchase
  FROM public.purchases
  WHERE idempotency_key = v_computed_idempotency_key
  LIMIT 1;

  IF v_existing_purchase IS NOT NULL THEN
    SELECT available_balance_cents INTO v_fan_balance
    FROM public.wallet_accounts
    WHERE user_id = p_user_id;

    RETURN jsonb_build_object(
      'success', true,
      'purchase_id', v_existing_purchase,
      'idempotent', true,
      'balance_after_cents', COALESCE(v_fan_balance, 0)
    );
  END IF;

  -- Already purchased check
  SELECT id INTO v_existing_purchase
  FROM public.purchases
  WHERE fan_id = p_user_id
    AND post_id = p_post_id
  LIMIT 1;

  IF v_existing_purchase IS NOT NULL THEN
    UPDATE public.purchases
    SET idempotency_key = COALESCE(idempotency_key, v_computed_idempotency_key)
    WHERE id = v_existing_purchase;

    SELECT available_balance_cents INTO v_fan_balance
    FROM public.wallet_accounts
    WHERE user_id = p_user_id;

    RETURN jsonb_build_object(
      'success', true,
      'purchase_id', v_existing_purchase,
      'idempotent', true,
      'balance_after_cents', COALESCE(v_fan_balance, 0)
    );
  END IF;

  -- Ensure both wallets exist
  INSERT INTO public.wallet_accounts (user_id, available_balance_cents, pending_balance_cents)
  VALUES (p_user_id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.wallet_accounts (user_id, available_balance_cents, pending_balance_cents)
  VALUES (v_post.creator_id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- Lock fan wallet row and verify balance
  SELECT available_balance_cents
  INTO v_fan_balance
  FROM public.wallet_accounts
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF COALESCE(v_fan_balance, 0) < v_price_cents THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient balance',
      'required_cents', v_price_cents,
      'balance_cents', COALESCE(v_fan_balance, 0)
    );
  END IF;

  -- Create purchase
  INSERT INTO public.purchases (fan_id, post_id, paid_amount_cents, idempotency_key)
  VALUES (p_user_id, p_post_id, v_price_cents, v_computed_idempotency_key)
  RETURNING id INTO v_purchase_id;

  -- Fan debit (available balance)
  UPDATE public.wallet_accounts
  SET available_balance_cents = available_balance_cents - v_price_cents,
      updated_at = timezone('utc', now())
  WHERE user_id = p_user_id;

  -- Creator credit (pending until settlement)
  UPDATE public.wallet_accounts
  SET pending_balance_cents = pending_balance_cents + v_price_cents,
      updated_at = timezone('utc', now())
  WHERE user_id = v_post.creator_id;

  -- Fan transaction
  INSERT INTO public.transactions (user_id, type, amount_cents, status, metadata)
  VALUES (
    p_user_id,
    'ppv_purchase',
    -v_price_cents,
    'completed',
    jsonb_build_object(
      'post_id', p_post_id,
      'creator_id', v_post.creator_id,
      'purchase_id', v_purchase_id,
      'idempotency_key', v_computed_idempotency_key
    )
  );

  -- Creator pending revenue transaction
  INSERT INTO public.transactions (user_id, type, amount_cents, status, available_on, metadata)
  VALUES (
    v_post.creator_id,
    'ppv_revenue',
    v_price_cents,
    'pending',
    timezone('utc', now()) + interval '7 days',
    jsonb_build_object(
      'post_id', p_post_id,
      'fan_id', p_user_id,
      'purchase_id', v_purchase_id
    )
  );

  SELECT available_balance_cents INTO v_fan_balance
  FROM public.wallet_accounts
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'purchase_id', v_purchase_id,
    'idempotent', false,
    'amount_cents', v_price_cents,
    'balance_after_cents', COALESCE(v_fan_balance, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.unlock_ppv(UUID, UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.unlock_ppv IS
  'Migration 030: auth-bound, cents-based PPV unlock with idempotency and pending creator revenue.';

-- --------------------------------------------
-- 3. recharge_wallet (caller validation + idempotency)
-- --------------------------------------------
CREATE OR REPLACE FUNCTION public.recharge_wallet(
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
  v_new_balance BIGINT;
  v_existing_balance BIGINT;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Unauthorized: caller identity mismatch'
    );
  END IF;

  IF p_amount_cents IS NULL OR p_amount_cents <= 0 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Invalid amount'
    );
  END IF;

  -- Fast idempotent return path
  IF p_idempotency_key IS NOT NULL AND p_idempotency_key <> '' THEN
    SELECT wa.available_balance_cents
    INTO v_existing_balance
    FROM public.transactions t
    LEFT JOIN public.wallet_accounts wa ON wa.user_id = t.user_id
    WHERE t.user_id = p_user_id
      AND t.type = 'deposit'
      AND t.status = 'completed'
      AND t.metadata->>'idempotency_key' = p_idempotency_key
    ORDER BY t.created_at DESC
    LIMIT 1;

    IF v_existing_balance IS NOT NULL THEN
      RETURN json_build_object(
        'success', true,
        'balance_cents', v_existing_balance,
        'idempotent', true
      );
    END IF;
  END IF;

  INSERT INTO public.wallet_accounts (user_id, available_balance_cents, pending_balance_cents)
  VALUES (p_user_id, p_amount_cents, 0)
  ON CONFLICT (user_id) DO UPDATE
    SET available_balance_cents = public.wallet_accounts.available_balance_cents + EXCLUDED.available_balance_cents,
        updated_at = timezone('utc', now())
  RETURNING available_balance_cents INTO v_new_balance;

  BEGIN
    INSERT INTO public.transactions (user_id, type, amount_cents, status, metadata)
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
  EXCEPTION
    WHEN unique_violation THEN
      -- If a concurrent request won idempotency race, return current wallet balance idempotently.
      SELECT available_balance_cents INTO v_new_balance
      FROM public.wallet_accounts
      WHERE user_id = p_user_id;

      RETURN json_build_object(
        'success', true,
        'balance_cents', COALESCE(v_new_balance, 0),
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

GRANT EXECUTE ON FUNCTION public.recharge_wallet(UUID, INTEGER, TEXT) TO authenticated;

COMMENT ON FUNCTION public.recharge_wallet IS
  'Migration 030: auth.uid caller check, positive amount validation, and idempotent recharge semantics.';
