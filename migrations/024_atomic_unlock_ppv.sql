-- ============================================
-- Migration 024: Atomic PPV Unlock with Idempotency
-- ============================================
-- Purpose: Fix purchase vs transactions mismatch
-- Features:
-- 1. Atomic transaction for unlock (all-or-nothing)
-- 2. Idempotency key to prevent double charge
-- 3. Balance check before deduction
-- 4. Automatic wallet balance updates
-- 5. Creator pending credit tracking

-- Add idempotency_key to purchases table
ALTER TABLE public.purchases
ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_purchases_idempotency_key 
ON public.purchases(idempotency_key);

-- Add username to profiles table (without unique constraint first)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS username TEXT;

-- Backfill username from display_name with uniqueness guarantee
-- Use id suffix to ensure uniqueness
DO $$
DECLARE
  profile_record RECORD;
  base_username TEXT;
  final_username TEXT;
  counter INT;
BEGIN
  FOR profile_record IN 
    SELECT id, display_name 
    FROM public.profiles 
    WHERE username IS NULL
  LOOP
    -- Generate base username from display_name or id
    base_username := LOWER(REPLACE(
      COALESCE(profile_record.display_name, profile_record.id::text), 
      ' ', 
      '_'
    ));
    
    -- Remove special characters
    base_username := REGEXP_REPLACE(base_username, '[^a-z0-9_]', '', 'g');
    
    -- Ensure it starts with a letter or underscore
    IF base_username !~ '^[a-z_]' THEN
      base_username := '_' || base_username;
    END IF;
    
    -- Check if username exists, if so, append counter
    final_username := base_username;
    counter := 1;
    
    WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
      final_username := base_username || '_' || counter;
      counter := counter + 1;
    END LOOP;
    
    -- Update with unique username
    UPDATE public.profiles
    SET username = final_username
    WHERE id = profile_record.id;
  END LOOP;
END $$;

-- Now add NOT NULL constraint
ALTER TABLE public.profiles
ALTER COLUMN username SET NOT NULL;

-- Add unique constraint after ensuring all usernames are unique
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_username_key UNIQUE (username);

CREATE INDEX IF NOT EXISTS idx_profiles_username 
ON public.profiles(username);

-- ============================================
-- RPC Function: unlock_ppv
-- ============================================
-- Atomic PPV unlock with full accounting integrity
-- Returns: { success: boolean, purchase_id?: uuid, error?: string, balance?: number }

CREATE OR REPLACE FUNCTION public.unlock_ppv(
  p_post_id UUID,
  p_user_id UUID,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
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
  -- Generate idempotency key if not provided
  v_computed_idempotency_key := COALESCE(
    p_idempotency_key,
    'unlock_' || p_post_id::text || '_' || p_user_id::text || '_' || EXTRACT(EPOCH FROM NOW())::text
  );

  -- Check for existing purchase with same idempotency key
  SELECT id INTO v_existing_purchase
  FROM public.purchases
  WHERE idempotency_key = v_computed_idempotency_key
  LIMIT 1;

  IF v_existing_purchase IS NOT NULL THEN
    -- Already purchased with this key, return existing purchase
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
    -- Update idempotency key for existing purchase
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

  -- Get fan wallet
  SELECT * INTO v_fan_wallet
  FROM public.wallet_accounts
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    -- Create wallet if doesn't exist
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

  -- Start atomic transaction
  -- 1. Create purchase record
  INSERT INTO public.purchases (
    user_id,
    post_id,
    amount,
    status,
    idempotency_key,
    created_at
  ) VALUES (
    p_user_id,
    p_post_id,
    v_post.price,
    'completed',
    v_computed_idempotency_key,
    NOW()
  ) RETURNING id INTO v_purchase_id;

  -- 2. Deduct from fan wallet
  UPDATE public.wallet_accounts
  SET balance = balance - v_post.price,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  -- 3. Add to creator wallet (pending)
  UPDATE public.wallet_accounts
  SET balance = balance + v_post.price,
      updated_at = NOW()
  WHERE user_id = v_post.creator_id;

  -- 4. Create fan debit transaction
  INSERT INTO public.transactions (
    user_id,
    amount,
    type,
    status,
    description,
    related_id,
    created_at
  ) VALUES (
    p_user_id,
    -v_post.price,
    'ppv_unlock',
    'completed',
    'PPV unlock: ' || COALESCE(v_post.title, 'Untitled'),
    p_purchase_id,
    NOW()
  );

  -- 5. Create creator credit transaction
  INSERT INTO public.transactions (
    user_id,
    amount,
    type,
    status,
    description,
    related_id,
    created_at
  ) VALUES (
    v_post.creator_id,
    v_post.price,
    'ppv_revenue',
    'pending',
    'PPV revenue from post: ' || COALESCE(v_post.title, 'Untitled'),
    p_purchase_id,
    NOW()
  ) RETURNING id INTO v_transaction_id;

  -- Get final balance
  SELECT balance INTO v_final_balance
  FROM public.wallet_accounts
  WHERE user_id = p_user_id;

  -- Return success
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
    -- Rollback happens automatically
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Transaction failed: ' || SQLERRM
    );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.unlock_ppv(UUID, UUID, TEXT) TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.unlock_ppv IS 'Atomic PPV unlock with idempotency, balance check, and full accounting integrity';
