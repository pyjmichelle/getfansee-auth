-- 061: Bind retries to monetary intents, serialize grants, and resolve prices
-- and fee snapshots inside the payment transaction. Never apply automatically
-- to production; exercise on the isolated database first.

CREATE OR REPLACE FUNCTION public.spend_wallet(
  p_fan_id           UUID,
  p_creator_id       UUID,
  p_kind             TEXT,
  p_gross_cents      BIGINT,
  p_platform_fee_bps INTEGER,
  p_idempotency_key  TEXT,
  p_reference_type   TEXT,
  p_reference_id     UUID,
  p_buyer_country    TEXT,
  p_buyer_region     TEXT,
  p_available_on     TIMESTAMPTZ
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance       BIGINT;
  v_fee_cents     BIGINT;
  v_net_cents     BIGINT;
  v_order_id      UUID;
  v_new_balance   BIGINT;
  v_existing public.consumption_orders%ROWTYPE;
BEGIN
  IF p_gross_cents IS NULL OR p_gross_cents <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Invalid amount');
  END IF;
  IF p_fan_id = p_creator_id THEN
    RETURN json_build_object('success', false, 'error', 'Cannot purchase from yourself');
  END IF;
  IF p_platform_fee_bps IS NULL OR p_platform_fee_bps < 0 OR p_platform_fee_bps > 10000 THEN
    RETURN json_build_object('success', false, 'error', 'Invalid fee rate');
  END IF;
  IF p_idempotency_key IS NULL OR p_idempotency_key = '' THEN
    RETURN json_build_object('success', false, 'error', 'Missing idempotency key');
  END IF;

  -- A retry belongs to exactly one monetary intent. Serialize on the key
  -- before checking it so two transactions cannot pass the check concurrently.
  PERFORM pg_advisory_xact_lock(hashtextextended('spend:' || p_idempotency_key, 0));
  SELECT * INTO v_existing FROM public.consumption_orders
  WHERE idempotency_key = p_idempotency_key FOR UPDATE;
  IF FOUND THEN
    IF v_existing.fan_id IS DISTINCT FROM p_fan_id
       OR v_existing.creator_id IS DISTINCT FROM p_creator_id
       OR v_existing.kind IS DISTINCT FROM p_kind
       OR v_existing.gross_amount_cents IS DISTINCT FROM p_gross_cents
       OR v_existing.reference_type IS DISTINCT FROM p_reference_type
       OR (p_reference_id IS NOT NULL AND v_existing.reference_id IS DISTINCT FROM p_reference_id) THEN
      RETURN json_build_object('success', false, 'error', 'Idempotency key conflicts with another purchase');
    END IF;
    IF v_existing.reversed_at IS NOT NULL THEN
      RETURN json_build_object('success', false, 'error', 'Purchase was refunded; use a new idempotency key');
    END IF;
    SELECT available_balance_cents INTO v_new_balance
    FROM public.wallet_accounts WHERE user_id = p_fan_id;
    RETURN json_build_object(
      'success', true, 'idempotent', true,
      'consumption_order_id', v_existing.id,
      'balance_after_cents', COALESCE(v_new_balance, 0),
      'gross_amount_cents', v_existing.gross_amount_cents,
      'platform_fee_cents', v_existing.platform_fee_cents,
      'creator_net_cents', v_existing.creator_net_cents
    );
  END IF;

  v_fee_cents := ROUND(p_gross_cents * p_platform_fee_bps / 10000.0);
  v_net_cents := p_gross_cents - v_fee_cents;

  -- Lock the fan's wallet for the duration: the balance check and the debit
  -- must be one indivisible step or concurrent purchases can both pass a check
  -- that only one of them can afford.
  SELECT available_balance_cents INTO v_balance
  FROM public.wallet_accounts
  WHERE user_id = p_fan_id
  FOR UPDATE;

  IF NOT FOUND OR COALESCE(v_balance, 0) < p_gross_cents THEN
    RETURN json_build_object(
      'success', false, 'error', 'Insufficient balance',
      'balance_cents', COALESCE(v_balance, 0)
    );
  END IF;

    INSERT INTO public.consumption_orders (
      fan_id, creator_id, kind, gross_amount_cents,
      platform_fee_bps, platform_fee_cents, creator_net_cents,
      reference_type, reference_id, idempotency_key,
      buyer_country, buyer_region
    )
    VALUES (
      p_fan_id, p_creator_id, p_kind, p_gross_cents,
      p_platform_fee_bps, v_fee_cents, v_net_cents,
      p_reference_type, p_reference_id, p_idempotency_key,
      p_buyer_country, p_buyer_region
    )
    RETURNING id INTO v_order_id;

  UPDATE public.wallet_accounts
    SET available_balance_cents = available_balance_cents - p_gross_cents,
        updated_at = timezone('utc', now())
    WHERE user_id = p_fan_id
    RETURNING available_balance_cents INTO v_new_balance;

  INSERT INTO public.creator_ledger (
    creator_id, entry_type, amount_cents, state,
    consumption_order_id, available_on, idempotency_key
  )
  VALUES (
    p_creator_id, 'earning', v_net_cents, 'pending',
    v_order_id, p_available_on, 'earn_' || p_idempotency_key
  );

  INSERT INTO public.wallet_accounts (user_id, available_balance_cents, pending_balance_cents)
  VALUES (p_creator_id, 0, v_net_cents)
  ON CONFLICT (user_id) DO UPDATE
    SET pending_balance_cents = public.wallet_accounts.pending_balance_cents + EXCLUDED.pending_balance_cents,
        updated_at = timezone('utc', now());

  -- Mirror into `transactions` so existing history UI keeps working unchanged.
  INSERT INTO public.transactions (user_id, type, amount_cents, status, metadata)
  VALUES (
    p_fan_id,
    CASE p_kind WHEN 'ppv' THEN 'ppv_purchase' WHEN 'tip' THEN 'tip' ELSE 'subscription' END,
    -p_gross_cents, 'completed',
    jsonb_build_object(
      'creator_id', p_creator_id,
      'consumption_order_id', v_order_id,
      'idempotency_key', p_idempotency_key,
      'reference_type', p_reference_type,
      'reference_id', p_reference_id
    )
  );

  INSERT INTO public.transactions (user_id, type, amount_cents, status, available_on, metadata)
  VALUES (
    p_creator_id,
    CASE p_kind WHEN 'ppv' THEN 'ppv_revenue' WHEN 'tip' THEN 'tip' ELSE 'subscription' END,
    v_net_cents, 'pending', p_available_on,
    jsonb_build_object(
      'fan_id', p_fan_id,
      'consumption_order_id', v_order_id,
      'gross_amount_cents', p_gross_cents,
      'platform_fee_cents', v_fee_cents,
      'platform_fee_bps', p_platform_fee_bps
    )
  );

  RETURN json_build_object(
    'success', true, 'idempotent', false,
    'consumption_order_id', v_order_id,
    'balance_after_cents', v_new_balance,
    'platform_fee_cents', v_fee_cents,
    'creator_net_cents', v_net_cents,
    'gross_amount_cents', p_gross_cents
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.spend_wallet_on_ppv(
  p_fan_id           UUID,
  p_post_id          UUID,
  p_creator_id       UUID,
  p_price_cents      BIGINT,
  p_platform_fee_bps INTEGER,
  p_idempotency_key  TEXT,
  p_buyer_country    TEXT,
  p_buyer_region     TEXT,
  p_available_on     TIMESTAMPTZ
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_spend            JSON;
  v_purchase_id      UUID;
  v_balance          BIGINT;
  v_creator_id       UUID;
  v_price_cents      BIGINT;
  v_platform_fee_bps INTEGER;
  v_available_on     TIMESTAMPTZ := timezone('utc', now()) + interval '7 days';
BEGIN
  -- One buyer/post lock covers the entitlement check and the debit. A second
  -- click with a different retry key must still observe the first purchase.
  PERFORM pg_advisory_xact_lock(hashtextextended('ppv:' || p_fan_id::text || ':' || p_post_id::text, 0));
  SELECT posts.creator_id, posts.price_cents
    INTO v_creator_id, v_price_cents
  FROM public.posts
  WHERE posts.id = p_post_id
    AND posts.visibility = 'ppv'
    AND posts.review_status = 'approved'
    AND posts.deleted_at IS NULL
  FOR SHARE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Post is not available for PPV');
  END IF;
  IF v_price_cents IS NULL OR v_price_cents <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Invalid post price');
  END IF;

  -- Fee policy is authoritative here too: 0% during an active founding window,
  -- otherwise the standard 20%. Caller-supplied fee/price/payee values are
  -- deliberately ignored.
  SELECT CASE
    WHEN profiles.commission_free_until > timezone('utc', now()) THEN 0
    ELSE 2000
  END
  INTO v_platform_fee_bps
  FROM public.profiles
  WHERE profiles.id = v_creator_id AND profiles.role = 'creator';
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Creator not found');
  END IF;
  v_platform_fee_bps := COALESCE(v_platform_fee_bps, 2000);

  SELECT id INTO v_purchase_id
  FROM public.purchases
  WHERE fan_id = p_fan_id AND post_id = p_post_id;

  IF FOUND THEN
    SELECT available_balance_cents INTO v_balance
    FROM public.wallet_accounts WHERE user_id = p_fan_id;
    RETURN json_build_object(
      'success', true, 'idempotent', true,
      'purchase_id', v_purchase_id,
      'balance_after_cents', COALESCE(v_balance, 0)
    );
  END IF;

  v_spend := public.spend_wallet(
    p_fan_id, v_creator_id, 'ppv', v_price_cents, v_platform_fee_bps,
    p_idempotency_key, 'purchase', NULL, p_buyer_country, p_buyer_region,
    v_available_on
  );

  IF (v_spend->>'success')::boolean IS NOT TRUE THEN
    RETURN v_spend;
  END IF;

  IF (v_spend->>'idempotent')::boolean IS TRUE THEN
    -- No purchase row exists (checked above). An existing spend cannot grant
    -- a fresh entitlement or have its financial reference silently rewritten.
    RETURN json_build_object('success', false, 'error', 'Existing payment has no matching purchase');
  END IF;

  INSERT INTO public.purchases (fan_id, post_id, paid_amount_cents, idempotency_key)
  VALUES (p_fan_id, p_post_id, v_price_cents, p_idempotency_key)
  RETURNING id INTO v_purchase_id;

  UPDATE public.consumption_orders
  SET reference_id = v_purchase_id
  WHERE id = (v_spend->>'consumption_order_id')::uuid;

  RETURN jsonb_set(v_spend::jsonb, '{purchase_id}', to_jsonb(v_purchase_id))::json;
END;
$$;

CREATE OR REPLACE FUNCTION public.spend_wallet_on_tip(
  p_fan_id           UUID,
  p_creator_id       UUID,
  p_post_id          UUID,
  p_amount_cents     BIGINT,
  p_message          TEXT,
  p_platform_fee_bps INTEGER,
  p_idempotency_key  TEXT,
  p_buyer_country    TEXT,
  p_buyer_region     TEXT,
  p_available_on     TIMESTAMPTZ
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_spend    JSON;
  v_tip_id   UUID;
  v_balance  BIGINT;
  v_tip public.tips%ROWTYPE;
  v_creator public.profiles%ROWTYPE;
  v_fee INTEGER;
BEGIN
  IF p_idempotency_key IS NULL OR p_idempotency_key = '' THEN
    RETURN json_build_object('success', false, 'error', 'Missing idempotency key');
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('spend:' || p_idempotency_key, 0));
  SELECT * INTO v_tip FROM public.tips WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_tip.fan_id IS DISTINCT FROM p_fan_id
       OR v_tip.creator_id IS DISTINCT FROM p_creator_id
       OR v_tip.post_id IS DISTINCT FROM p_post_id
       OR v_tip.amount_cents IS DISTINCT FROM p_amount_cents
       OR v_tip.message IS DISTINCT FROM p_message THEN
      RETURN json_build_object('success', false, 'error', 'Idempotency key conflicts with another tip');
    END IF;
    IF EXISTS (SELECT 1 FROM public.consumption_orders
               WHERE idempotency_key = p_idempotency_key AND reversed_at IS NOT NULL) THEN
      RETURN json_build_object('success', false, 'error', 'Tip was refunded');
    END IF;
    SELECT available_balance_cents INTO v_balance
    FROM public.wallet_accounts WHERE user_id = p_fan_id;
    RETURN json_build_object('success', true, 'idempotent', true,
      'tip_id', v_tip.id, 'balance_after_cents', COALESCE(v_balance, 0));
  END IF;

  SELECT * INTO v_creator FROM public.profiles WHERE id = p_creator_id FOR SHARE;
  IF NOT FOUND OR v_creator.role <> 'creator' THEN
    RETURN json_build_object('success', false, 'error', 'Creator not found');
  END IF;
  IF p_amount_cents IS NULL OR p_amount_cents < 100 OR p_amount_cents > 50000 THEN
    RETURN json_build_object('success', false, 'error', 'Invalid tip amount');
  END IF;
  IF p_post_id IS NOT NULL THEN
    PERFORM 1 FROM public.posts WHERE id = p_post_id AND creator_id = p_creator_id
      AND review_status = 'approved' AND deleted_at IS NULL FOR SHARE;
    IF NOT FOUND THEN
      RETURN json_build_object('success', false, 'error', 'Post does not belong to this creator');
    END IF;
  END IF;
  PERFORM 1 FROM public.creator_tip_settings WHERE creator_id = p_creator_id AND enabled = false FOR SHARE;
  IF FOUND THEN
    RETURN json_build_object('success', false, 'error', 'This creator is not accepting tips');
  END IF;
  v_fee := CASE WHEN v_creator.commission_free_until > timezone('utc', now()) THEN 0 ELSE 2000 END;

  v_spend := public.spend_wallet(
    p_fan_id, p_creator_id, 'tip', p_amount_cents, v_fee,
    p_idempotency_key, 'tip', NULL, p_buyer_country, p_buyer_region,
    timezone('utc', now()) + interval '7 days'
  );

  IF (v_spend->>'success')::boolean IS NOT TRUE THEN
    RETURN v_spend;
  END IF;

  IF (v_spend->>'idempotent')::boolean IS TRUE THEN
    RETURN json_build_object('success', false, 'error', 'Existing payment has no matching tip');
  END IF;

  INSERT INTO public.tips (
    fan_id, creator_id, post_id, amount_cents, message,
    platform_fee_cents, creator_net_cents, idempotency_key
  )
  VALUES (
    p_fan_id, p_creator_id, p_post_id, p_amount_cents, p_message,
    (v_spend->>'platform_fee_cents')::bigint,
    (v_spend->>'creator_net_cents')::bigint,
    p_idempotency_key
  )
  RETURNING id INTO v_tip_id;

  UPDATE public.consumption_orders
    SET reference_id = v_tip_id
    WHERE id = (v_spend->>'consumption_order_id')::uuid;

  RETURN jsonb_set(v_spend::jsonb, '{tip_id}', to_jsonb(v_tip_id))::json;
END;
$$;

CREATE OR REPLACE FUNCTION public.spend_wallet_on_subscription(
  p_fan_id           UUID,
  p_creator_id       UUID,
  p_price_cents      BIGINT,
  p_platform_fee_bps INTEGER,
  p_idempotency_key  TEXT,
  p_period_days      INTEGER,
  p_buyer_country    TEXT,
  p_buyer_region     TEXT,
  p_available_on     TIMESTAMPTZ
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_spend       JSON;
  v_sub_id      UUID;
  v_period_end  TIMESTAMPTZ;
  v_balance     BIGINT;
  v_now         TIMESTAMPTZ := timezone('utc', now());
  v_creator public.profiles%ROWTYPE;
  v_price BIGINT;
  v_fee INTEGER;
BEGIN
  IF p_period_days IS DISTINCT FROM 30 THEN
    RETURN json_build_object('success', false, 'error', 'Invalid period');
  END IF;

  -- Serialise every subscribe attempt for this pair. The lock is released at
  -- commit, so the loser of a double-submit reads the winner's committed grant
  -- and takes the idempotent path below instead of charging.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_fan_id::text || ':' || p_creator_id::text, 0)
  );

  -- Already inside a paid period: there is nothing to sell.
  SELECT id, current_period_end INTO v_sub_id, v_period_end
  FROM public.subscriptions
  WHERE subscriber_id = p_fan_id AND creator_id = p_creator_id
  FOR UPDATE;

  IF FOUND AND v_period_end > v_now THEN
    SELECT available_balance_cents INTO v_balance
    FROM public.wallet_accounts WHERE user_id = p_fan_id;
    RETURN json_build_object(
      'success', true, 'idempotent', true, 'already_subscribed', true,
      'subscription_id', v_sub_id,
      'current_period_end', v_period_end,
      'balance_after_cents', COALESCE(v_balance, 0)
    );
  END IF;

  SELECT * INTO v_creator FROM public.profiles WHERE id = p_creator_id FOR SHARE;
  IF NOT FOUND OR v_creator.role <> 'creator' THEN
    RETURN json_build_object('success', false, 'error', 'Creator not found');
  END IF;
  v_price := v_creator.subscription_price_cents;
  IF v_price IS NULL OR v_price <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Creator has no paid subscription');
  END IF;
  v_fee := CASE WHEN v_creator.commission_free_until > v_now THEN 0 ELSE 2000 END;

  v_spend := public.spend_wallet(
    p_fan_id, p_creator_id, 'subscription', v_price, v_fee,
    p_idempotency_key, 'subscription', NULL, p_buyer_country, p_buyer_region,
    v_now + interval '7 days'
  );

  IF (v_spend->>'success')::boolean IS NOT TRUE THEN
    RETURN v_spend;
  END IF;

  IF (v_spend->>'idempotent')::boolean IS TRUE THEN
    RETURN json_build_object('success', false, 'error', 'Existing payment cannot grant another subscription period');
  END IF;

  -- Extend from whichever is later: an unexpired-but-cancelled period the fan
  -- already paid for must not be shortened by re-subscribing.
  v_period_end := GREATEST(COALESCE(v_period_end, v_now), v_now)
                  + (p_period_days || ' days')::INTERVAL;

  INSERT INTO public.subscriptions (
    subscriber_id, creator_id, plan, status, current_period_end, cancelled_at
  )
  VALUES (p_fan_id, p_creator_id, 'monthly', 'active', v_period_end, NULL)
  ON CONFLICT (subscriber_id, creator_id) DO UPDATE
    SET status = 'active',
        plan = 'monthly',
        current_period_end = EXCLUDED.current_period_end,
        cancelled_at = NULL
  RETURNING id INTO v_sub_id;

  UPDATE public.consumption_orders
    SET reference_id = v_sub_id
    WHERE id = (v_spend->>'consumption_order_id')::uuid;

  RETURN jsonb_set(
    jsonb_set(v_spend::jsonb, '{subscription_id}', to_jsonb(v_sub_id)),
    '{current_period_end}', to_jsonb(v_period_end)
  )::json;
END;
$$;

DO $$
DECLARE v_proc record;
BEGIN
  FOR v_proc IN SELECT p.oid::regprocedure AS signature FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN
      ('spend_wallet', 'spend_wallet_on_ppv', 'spend_wallet_on_tip', 'spend_wallet_on_subscription')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', v_proc.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', v_proc.signature);
  END LOOP;
END;
$$;
