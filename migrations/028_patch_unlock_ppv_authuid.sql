-- Migration 028: Patch unlock_ppv to enforce auth.uid() == p_user_id
-- Security fix: SECURITY DEFINER function must explicitly verify the caller
-- matches p_user_id to prevent one user unlocking posts on behalf of another.

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
  v_fan_wallet RECORD;
  v_creator_wallet RECORD;
  v_existing_purchase UUID;
  v_purchase_id UUID;
  v_transaction_id UUID;
  v_final_balance NUMERIC(10,2);
  v_computed_idempotency_key TEXT;
BEGIN
  -- Security: SECURITY DEFINER bypasses RLS, so we must enforce caller identity here.
  -- auth.uid() returns the JWT claim regardless of the execution role.
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized: caller identity mismatch'
    );
  END IF;

  -- Generate idempotency key if not provided
  v_computed_idempotency_key := COALESCE(
    p_idempotency_key,
    'unlock_' || p_post_id::text || '_' || p_user_id::text || '_' || EXTRACT(EPOCH FROM NOW())::text
  );

  -- Idempotency: return cached result if same key already succeeded
  SELECT id INTO v_existing_purchase
  FROM public.purchases
  WHERE idempotency_key = v_computed_idempotency_key
  LIMIT 1;

  IF v_existing_purchase IS NOT NULL THEN
    SELECT balance INTO v_final_balance
    FROM public.wallet_accounts
    WHERE user_id = p_user_id;

    RETURN jsonb_build_object(
      'success', true,
      'purchase_id', v_existing_purchase,
      'message', 'Already purchased (idempotent)',
      'balance', COALESCE(v_final_balance, 0)
    );
  END IF;

  -- Check if already purchased (without idempotency key)
  SELECT id INTO v_existing_purchase
  FROM public.purchases
  WHERE user_id = p_user_id
    AND post_id = p_post_id
    AND status = 'completed'
  LIMIT 1;

  IF v_existing_purchase IS NOT NULL THEN
    UPDATE public.purchases
    SET idempotency_key = v_computed_idempotency_key
    WHERE id = v_existing_purchase;

    SELECT balance INTO v_final_balance
    FROM public.wallet_accounts
    WHERE user_id = p_user_id;

    RETURN jsonb_build_object(
      'success', true,
      'purchase_id', v_existing_purchase,
      'message', 'Already purchased',
      'balance', COALESCE(v_final_balance, 0)
    );
  END IF;

  -- Get post details
  SELECT p.*, pr.user_id as creator_id
  INTO v_post
  FROM public.posts p
  JOIN public.profiles pr ON p.creator_id = pr.id
  WHERE p.id = p_post_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Post not found'
    );
  END IF;

  -- Verify post is PPV
  IF v_post.visibility != 'ppv' OR v_post.price IS NULL OR v_post.price <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Post is not a valid PPV post'
    );
  END IF;

  -- Get or create fan wallet
  SELECT * INTO v_fan_wallet
  FROM public.wallet_accounts
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    INSERT INTO public.wallet_accounts (user_id, balance, currency)
    VALUES (p_user_id, 0, 'USD')
    RETURNING * INTO v_fan_wallet;
  END IF;

  -- Check sufficient balance
  IF v_fan_wallet.balance < v_post.price THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient balance',
      'required', v_post.price,
      'balance', v_fan_wallet.balance
    );
  END IF;

  -- Get or create creator wallet
  SELECT * INTO v_creator_wallet
  FROM public.wallet_accounts
  WHERE user_id = v_post.creator_id;

  IF NOT FOUND THEN
    INSERT INTO public.wallet_accounts (user_id, balance, currency)
    VALUES (v_post.creator_id, 0, 'USD')
    RETURNING * INTO v_creator_wallet;
  END IF;

  -- Atomic purchase + balance transfer + transaction records
  INSERT INTO public.purchases (
    user_id, post_id, amount, status, idempotency_key, created_at
  ) VALUES (
    p_user_id, p_post_id, v_post.price, 'completed', v_computed_idempotency_key, NOW()
  ) RETURNING id INTO v_purchase_id;

  UPDATE public.wallet_accounts
  SET balance = balance - v_post.price, updated_at = NOW()
  WHERE user_id = p_user_id;

  UPDATE public.wallet_accounts
  SET balance = balance + v_post.price, updated_at = NOW()
  WHERE user_id = v_post.creator_id;

  INSERT INTO public.transactions (
    user_id, amount, type, status, description, related_id, created_at
  ) VALUES (
    p_user_id, -v_post.price, 'ppv_unlock', 'completed',
    'PPV unlock: ' || COALESCE(v_post.title, 'Untitled'), v_purchase_id, NOW()
  );

  INSERT INTO public.transactions (
    user_id, amount, type, status, description, related_id, created_at
  ) VALUES (
    v_post.creator_id, v_post.price, 'ppv_revenue', 'pending',
    'PPV revenue from post: ' || COALESCE(v_post.title, 'Untitled'), v_purchase_id, NOW()
  ) RETURNING id INTO v_transaction_id;

  SELECT balance INTO v_final_balance
  FROM public.wallet_accounts
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'purchase_id', v_purchase_id,
    'transaction_id', v_transaction_id,
    'amount', v_post.price,
    'balance', v_final_balance,
    'message', 'Purchase completed successfully'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Transaction failed: ' || SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION public.unlock_ppv IS
  'Atomic PPV unlock with auth.uid() identity enforcement, idempotency, and full accounting integrity. Migration 028 patch.';
