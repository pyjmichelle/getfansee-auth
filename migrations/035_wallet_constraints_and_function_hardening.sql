-- Migration 035: Wallet balance constraints + unlock_ppv / recharge_wallet hardening
-- Fixes HIGH-03, CRITICAL-06, HIGH-04, HIGH-05 from DATABASE_INTEGRITY_REPORT
-- Safe to run multiple times

-- ── 1. wallet_accounts: non-negative balance constraint ─────────────────────

ALTER TABLE public.wallet_accounts
  DROP CONSTRAINT IF EXISTS wallet_accounts_balance_non_negative;

ALTER TABLE public.wallet_accounts
  ADD CONSTRAINT wallet_accounts_balance_non_negative
  CHECK (available_balance_cents >= 0 AND pending_balance_cents >= 0);

-- ── 2. transactions.metadata: set DEFAULT '{}' and backfill NULLs ───────────

ALTER TABLE public.transactions
  ALTER COLUMN metadata SET DEFAULT '{}'::jsonb;

UPDATE public.transactions
  SET metadata = '{}'::jsonb
  WHERE metadata IS NULL;

-- ── 3. purchases.idempotency_key: backfill legacy NULLs ─────────────────────
-- (NOT NULL enforcement is omitted here to avoid breaking existing rows;
--  the trigger below ensures all future rows have a key)

UPDATE public.purchases
  SET idempotency_key = 'legacy_' || id::text
  WHERE idempotency_key IS NULL;

-- Auto-generate idempotency_key for any INSERT that omits it
CREATE OR REPLACE FUNCTION generate_purchase_idempotency_key()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.idempotency_key IS NULL OR NEW.idempotency_key = '' THEN
    NEW.idempotency_key := 'auto_' || NEW.id::text;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_purchase_idempotency_key ON public.purchases;
CREATE TRIGGER trg_purchase_idempotency_key
  BEFORE INSERT ON public.purchases
  FOR EACH ROW EXECUTE FUNCTION generate_purchase_idempotency_key();

-- ── 4. unlock_ppv: add advisory lock to prevent double-spending ──────────────
-- Replaces the TOCTOU SELECT → SELECT pattern with an advisory lock so
-- concurrent requests for the same (user, post) pair are serialised.

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

  -- Fetch post and price
  SELECT * INTO v_post FROM public.posts WHERE id = p_post_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Post not found');
  END IF;
  IF v_post.visibility != 'ppv' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Post is not PPV');
  END IF;
  IF v_post.price IS NULL OR v_post.price <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid post price');
  END IF;

  v_price_cents := ROUND(v_post.price * 100)::INTEGER;

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
    -- Rolled back by advisory lock; return existing purchase
    SELECT id INTO v_purchase_id
      FROM public.purchases WHERE fan_id = p_user_id AND post_id = p_post_id;
    -- Restore deducted balance (concurrent path)
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

-- ── 5. recharge_wallet: use SELECT FOR UPDATE to prevent lost updates ────────

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
  v_current_balance BIGINT;
  v_existing_tx_id UUID;
BEGIN
  -- Caller identity check
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized: caller identity mismatch');
  END IF;

  IF p_amount_cents IS NULL OR p_amount_cents <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Invalid amount');
  END IF;

  -- Idempotency check (using INNER JOIN so NULL wallet doesn't sneak through)
  IF p_idempotency_key IS NOT NULL AND p_idempotency_key <> '' THEN
    SELECT t.id INTO v_existing_tx_id
      FROM public.transactions t
      INNER JOIN public.wallet_accounts wa ON wa.user_id = t.user_id
      WHERE t.user_id = p_user_id
        AND t.type = 'deposit'
        AND t.status = 'completed'
        AND t.metadata->>'idempotency_key' = p_idempotency_key
      ORDER BY t.created_at DESC
      LIMIT 1;

    IF v_existing_tx_id IS NOT NULL THEN
      SELECT available_balance_cents INTO v_current_balance
        FROM public.wallet_accounts WHERE user_id = p_user_id;
      RETURN json_build_object(
        'success', true,
        'balance_cents', COALESCE(v_current_balance, 0),
        'idempotent', true,
        'transaction_id', v_existing_tx_id
      );
    END IF;
  END IF;

  -- Insert transaction first (unique idempotency_key index prevents duplicates)
  BEGIN
    INSERT INTO public.transactions (user_id, type, amount_cents, status, metadata)
      VALUES (
        p_user_id, 'deposit', p_amount_cents, 'completed',
        json_build_object(
          'payment_method', 'mock',
          'idempotency_key', p_idempotency_key
        )::jsonb
      );
  EXCEPTION WHEN unique_violation THEN
    SELECT available_balance_cents INTO v_current_balance
      FROM public.wallet_accounts WHERE user_id = p_user_id;
    RETURN json_build_object(
      'success', true,
      'balance_cents', COALESCE(v_current_balance, 0),
      'idempotent', true
    );
  END;

  -- Lock the wallet row to prevent concurrent lost-update
  SELECT available_balance_cents INTO v_current_balance
    FROM public.wallet_accounts
    WHERE user_id = p_user_id
    FOR UPDATE;

  IF v_current_balance IS NULL THEN
    INSERT INTO public.wallet_accounts (user_id, available_balance_cents, pending_balance_cents)
      VALUES (p_user_id, p_amount_cents, 0)
      RETURNING available_balance_cents INTO v_new_balance;
  ELSE
    UPDATE public.wallet_accounts
      SET available_balance_cents = available_balance_cents + p_amount_cents,
          updated_at = timezone('utc', now())
      WHERE user_id = p_user_id
      RETURNING available_balance_cents INTO v_new_balance;
  END IF;

  RETURN json_build_object(
    'success', true,
    'balance_cents', v_new_balance,
    'idempotent', false
  );
END;
$$;
