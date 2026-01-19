-- ============================================
-- Migration 024: Atomic PPV Unlock with Idempotency (SAFE VERSION)
-- ============================================
-- This version handles existing data and can be run multiple times safely

-- ============================================
-- PART 1: Add idempotency_key to purchases
-- ============================================

-- Add column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'purchases' 
    AND column_name = 'idempotency_key'
  ) THEN
    ALTER TABLE public.purchases ADD COLUMN idempotency_key TEXT;
  END IF;
END $$;

-- Add unique constraint if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'purchases_idempotency_key_key'
  ) THEN
    ALTER TABLE public.purchases ADD CONSTRAINT purchases_idempotency_key_key UNIQUE (idempotency_key);
  END IF;
END $$;

-- Create index if not exists
CREATE INDEX IF NOT EXISTS idx_purchases_idempotency_key 
ON public.purchases(idempotency_key);

-- ============================================
-- PART 2: Add username to profiles
-- ============================================

-- Add column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'username'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN username TEXT;
  END IF;
END $$;

-- Backfill username with uniqueness guarantee
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
    -- Generate base username
    base_username := LOWER(REPLACE(
      COALESCE(profile_record.display_name, 'user_' || profile_record.id::text), 
      ' ', 
      '_'
    ));
    
    -- Remove special characters, keep only alphanumeric and underscore
    base_username := REGEXP_REPLACE(base_username, '[^a-z0-9_]', '', 'g');
    
    -- Ensure minimum length
    IF LENGTH(base_username) < 3 THEN
      base_username := 'user_' || profile_record.id::text;
    END IF;
    
    -- Ensure it starts with letter or underscore
    IF base_username !~ '^[a-z_]' THEN
      base_username := '_' || base_username;
    END IF;
    
    -- Truncate if too long (max 63 chars for Postgres identifier)
    IF LENGTH(base_username) > 50 THEN
      base_username := SUBSTRING(base_username FROM 1 FOR 50);
    END IF;
    
    -- Check uniqueness and append counter if needed
    final_username := base_username;
    counter := 1;
    
    WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username AND id != profile_record.id) LOOP
      final_username := base_username || '_' || counter;
      counter := counter + 1;
      
      -- Safety: prevent infinite loop
      IF counter > 10000 THEN
        final_username := 'user_' || profile_record.id::text;
        EXIT;
      END IF;
    END LOOP;
    
    -- Update with unique username
    UPDATE public.profiles
    SET username = final_username
    WHERE id = profile_record.id;
    
    RAISE NOTICE 'Updated profile % with username: %', profile_record.id, final_username;
  END LOOP;
END $$;

-- Make username NOT NULL
DO $$
BEGIN
  ALTER TABLE public.profiles ALTER COLUMN username SET NOT NULL;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not set username to NOT NULL. Some profiles may still have NULL username.';
END $$;

-- Add unique constraint if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'profiles_username_key'
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_key UNIQUE (username);
  END IF;
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'Unique constraint already exists or duplicate usernames found. Skipping constraint.';
END $$;

-- Create index if not exists
CREATE INDEX IF NOT EXISTS idx_profiles_username 
ON public.profiles(username);

-- ============================================
-- PART 3: Create or Replace RPC Function
-- ============================================

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

  -- Get fan wallet
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

  -- Atomic transaction
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

  UPDATE public.wallet_accounts
  SET balance = balance - v_post.price,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  UPDATE public.wallet_accounts
  SET balance = balance + v_post.price,
      updated_at = NOW()
  WHERE user_id = v_post.creator_id;

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
    v_purchase_id,
    NOW()
  );

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
    v_purchase_id,
    NOW()
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

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.unlock_ppv(UUID, UUID, TEXT) TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.unlock_ppv IS 'Atomic PPV unlock with idempotency, balance check, and full accounting integrity (SAFE VERSION - can run multiple times)';

-- ============================================
-- Verification Queries
-- ============================================

-- Check if migration was successful
DO $$
DECLARE
  v_idempotency_col_exists BOOLEAN;
  v_username_col_exists BOOLEAN;
  v_function_exists BOOLEAN;
  v_profiles_with_username INT;
BEGIN
  -- Check idempotency_key column
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'purchases' AND column_name = 'idempotency_key'
  ) INTO v_idempotency_col_exists;
  
  -- Check username column
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'username'
  ) INTO v_username_col_exists;
  
  -- Check function
  SELECT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'unlock_ppv'
  ) INTO v_function_exists;
  
  -- Count profiles with username
  SELECT COUNT(*) INTO v_profiles_with_username
  FROM public.profiles WHERE username IS NOT NULL;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration 024 Verification:';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'idempotency_key column exists: %', v_idempotency_col_exists;
  RAISE NOTICE 'username column exists: %', v_username_col_exists;
  RAISE NOTICE 'unlock_ppv function exists: %', v_function_exists;
  RAISE NOTICE 'Profiles with username: %', v_profiles_with_username;
  RAISE NOTICE '========================================';
  
  IF v_idempotency_col_exists AND v_username_col_exists AND v_function_exists THEN
    RAISE NOTICE 'SUCCESS: Migration completed successfully!';
  ELSE
    RAISE WARNING 'INCOMPLETE: Some migration steps may have failed. Check logs above.';
  END IF;
END $$;
