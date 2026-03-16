-- Migration 036: Fix unlock_ppv field name regression (price → price_cents)
-- Migration 035 accidentally referenced v_post.price instead of v_post.price_cents,
-- causing all PPV purchases to fail with "Invalid post price".
-- This migration restores the correct field name while preserving all other
-- improvements from 035 (advisory lock, idempotency, SELECT FOR UPDATE).

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
  v_price_cents INTEGER;
  v_fan_balance BIGINT;
  v_existing_purchase UUID;
  v_purchase_id UUID;
  v_computed_idempotency_key TEXT;
  v_lock_key BIGINT;
BEGIN
  -- Caller identity check
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Compute idempotency key
  v_computed_idempotency_key := COALESCE(
    p_idempotency_key,
    'ppv_' || p_user_id::text || '_' || p_post_id::text
  );

  -- Advisory lock scoped to this (user × post) pair – serialises concurrent requests
  v_lock_key := ('x' || substr(md5(p_user_id::text || p_post_id::text), 1, 16))::bit(64)::bigint;
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Idempotency check (safe inside advisory lock)
  SELECT id INTO v_existing_purchase
    FROM public.purchases
    WHERE idempotency_key = v_computed_idempotency_key
    LIMIT 1;

  IF v_existing_purchase IS NOT NULL THEN
    SELECT available_balance_cents INTO v_fan_balance
      FROM public.wallet_accounts WHERE user_id = p_user_id;
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
    WHERE fan_id = p_user_id AND post_id = p_post_id
    LIMIT 1;

  IF v_existing_purchase IS NOT NULL THEN
    SELECT available_balance_cents INTO v_fan_balance
      FROM public.wallet_accounts WHERE user_id = p_user_id;
    RETURN jsonb_build_object(
      'success', true,
      'purchase_id', v_existing_purchase,
      'idempotent', true,
      'balance_after_cents', COALESCE(v_fan_balance, 0)
    );
  END IF;

  -- Fetch post using explicit column list (avoids SELECT * ambiguity)
  SELECT id, creator_id, price_cents, visibility
    INTO v_post
    FROM public.posts
    WHERE id = p_post_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Post not found');
  END IF;

  IF v_post.visibility != 'ppv' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Post is not PPV');
  END IF;

  -- Use price_cents directly (the actual column name, fixed from 035's v_post.price regression)
  IF v_post.price_cents IS NULL OR v_post.price_cents <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid post price');
  END IF;

  v_price_cents := v_post.price_cents;

  -- Lock fan wallet row and check balance
  SELECT available_balance_cents INTO v_fan_balance
    FROM public.wallet_accounts
    WHERE user_id = p_user_id
    FOR UPDATE;

  IF COALESCE(v_fan_balance, 0) < v_price_cents THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient balance',
      'balance_cents', COALESCE(v_fan_balance, 0),
      'required_cents', v_price_cents
    );
  END IF;

  -- Deduct balance
  UPDATE public.wallet_accounts
    SET available_balance_cents = available_balance_cents - v_price_cents,
        updated_at = timezone('utc', now())
    WHERE user_id = p_user_id;

  -- Record purchase (unique constraint on fan_id+post_id prevents duplicates)
  BEGIN
    INSERT INTO public.purchases (fan_id, post_id, paid_amount_cents, idempotency_key)
      VALUES (p_user_id, p_post_id, v_price_cents, v_computed_idempotency_key)
      RETURNING id INTO v_purchase_id;
  EXCEPTION WHEN unique_violation THEN
    -- Restore deducted balance (concurrent path already committed a purchase)
    SELECT id INTO v_purchase_id
      FROM public.purchases WHERE fan_id = p_user_id AND post_id = p_post_id;
    UPDATE public.wallet_accounts
      SET available_balance_cents = available_balance_cents + v_price_cents,
          updated_at = timezone('utc', now())
      WHERE user_id = p_user_id;
    SELECT available_balance_cents INTO v_fan_balance
      FROM public.wallet_accounts WHERE user_id = p_user_id;
    RETURN jsonb_build_object(
      'success', true,
      'purchase_id', v_purchase_id,
      'idempotent', true,
      'balance_after_cents', COALESCE(v_fan_balance, 0)
    );
  END;

  -- Fan debit transaction
  INSERT INTO public.transactions (user_id, type, amount_cents, status, metadata)
    VALUES (
      p_user_id, 'ppv_purchase', -v_price_cents, 'completed',
      jsonb_build_object(
        'post_id', p_post_id,
        'creator_id', v_post.creator_id,
        'purchase_id', v_purchase_id,
        'idempotency_key', v_computed_idempotency_key
      )
    );

  -- Creator pending revenue
  INSERT INTO public.transactions (user_id, type, amount_cents, status, available_on, metadata)
    VALUES (
      v_post.creator_id, 'ppv_revenue', v_price_cents, 'pending',
      timezone('utc', now()) + interval '7 days',
      jsonb_build_object(
        'post_id', p_post_id,
        'fan_id', p_user_id,
        'purchase_id', v_purchase_id
      )
    );

  -- Update creator pending balance
  INSERT INTO public.wallet_accounts (user_id, available_balance_cents, pending_balance_cents)
    VALUES (v_post.creator_id, 0, v_price_cents)
    ON CONFLICT (user_id) DO UPDATE
      SET pending_balance_cents = public.wallet_accounts.pending_balance_cents + v_price_cents,
          updated_at = timezone('utc', now());

  SELECT available_balance_cents INTO v_fan_balance
    FROM public.wallet_accounts WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'purchase_id', v_purchase_id,
    'idempotent', false,
    'balance_after_cents', COALESCE(v_fan_balance, 0)
  );
END;
$$;
