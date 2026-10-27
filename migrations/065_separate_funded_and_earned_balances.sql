-- 065: Funded spending and earned liabilities are distinct accounts.
-- Generated with Supabase CLI on 2026-10-12, moved to the repo's numbered stream.
-- Deploy ONLY in a maintenance window after isolated-project full-schema QA.
BEGIN;
LOCK TABLE public.wallet_accounts, public.creator_ledger, public.consumption_orders,
  public.transactions, public.withdrawal_requests IN ACCESS EXCLUSIVE MODE;

-- Stop rather than guess the source of historical mixed purchases or deficits.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.consumption_orders c WHERE EXISTS (
    SELECT 1 FROM public.creator_ledger l WHERE l.creator_id = c.fan_id AND l.entry_type = 'earning'
  )) THEN RAISE EXCEPTION 'Historical mixed spending requires reviewed reconciliation before account separation'; END IF;
  IF EXISTS (SELECT 1 FROM public.creator_ledger WHERE entry_type = 'earning' AND state = 'paid') THEN
    RAISE EXCEPTION 'Legacy paid earnings require reviewed reconciliation'; END IF;
  IF EXISTS (SELECT 1 FROM public.creator_ledger l LEFT JOIN public.wallet_accounts w ON w.user_id=l.creator_id
             WHERE w.user_id IS NULL) THEN RAISE EXCEPTION 'Orphan earned liability requires reconciliation'; END IF;
END;
$$;
CREATE TEMP TABLE _account_split ON COMMIT DROP AS
  SELECT w.user_id, w.available_balance_cents AS old_available_cents,
    w.pending_balance_cents AS old_pending_cents,
    COALESCE((SELECT SUM(amount_cents) FROM public.creator_ledger WHERE creator_id=w.user_id AND state='available'),0)::bigint AS earned_available_cents,
    COALESCE((SELECT SUM(amount_cents) FROM public.creator_ledger WHERE creator_id=w.user_id AND state='pending'),0)::bigint AS earned_pending_cents,
    (COALESCE((SELECT SUM(amount_cents) FROM public.transactions WHERE user_id=w.user_id AND type='deposit' AND status='completed'),0)
     - COALESCE((SELECT SUM(gross_amount_cents) FROM public.consumption_orders WHERE fan_id=w.user_id AND reversed_at IS NULL),0)
     + COALESCE((SELECT SUM(amount_cents) FROM public.transactions WHERE user_id=w.user_id AND type='refund' AND amount_cents<0 AND status='completed' AND metadata->>'kind'='unspent_balance_return'),0))::bigint AS funded_cents
  FROM public.wallet_accounts w;
DO $$
BEGIN
 IF EXISTS (SELECT 1 FROM _account_split WHERE old_available_cents-earned_available_cents <> funded_cents
   OR funded_cents<0 OR old_pending_cents<>earned_pending_cents) THEN
   RAISE EXCEPTION 'Wallet opening balances do not reconcile; separation aborted without modifying balances';
 END IF;
 IF EXISTS (SELECT 1 FROM _account_split s WHERE earned_available_cents+earned_pending_cents <>
   COALESCE((SELECT SUM(creator_net_cents) FROM public.consumption_orders WHERE creator_id=s.user_id AND reversed_at IS NULL),0)
   - COALESCE((SELECT SUM(amount_cents) FROM public.withdrawal_requests WHERE creator_id=s.user_id AND status IN ('requested','paid')),0)) THEN
   RAISE EXCEPTION 'Earned opening balances do not reconcile';
 END IF;
END;
$$;
CREATE TABLE public.wallet_account_split_audit (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
 old_available_cents bigint NOT NULL, old_pending_cents bigint NOT NULL,
 earned_available_cents bigint NOT NULL, earned_pending_cents bigint NOT NULL,
 funded_cents bigint NOT NULL, migrated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.wallet_account_split_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.wallet_account_split_audit FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.wallet_account_split_audit TO service_role;
INSERT INTO public.wallet_account_split_audit SELECT *, now() FROM _account_split;
UPDATE public.wallet_accounts w SET available_balance_cents=s.funded_cents, pending_balance_cents=0,
 updated_at=timezone('utc',now()) FROM _account_split s WHERE w.user_id=s.user_id;
ALTER TABLE public.wallet_accounts ADD CONSTRAINT funded_balance_nonnegative CHECK (available_balance_cents >= 0),
 ADD CONSTRAINT funded_wallet_has_no_earned_pending CHECK (pending_balance_cents = 0);

-- A global write lock is deliberate MVP serialization. Every monetary entry
-- point takes it BEFORE row/key locks. Scale later only with proven lock ordering.
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
  PERFORM pg_advisory_xact_lock(hashtextextended('money-account-writes:v1', 0));
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
  PERFORM pg_advisory_xact_lock(hashtextextended('money-account-writes:v1', 0));
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
  PERFORM pg_advisory_xact_lock(hashtextextended('money-account-writes:v1', 0));
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
  PERFORM pg_advisory_xact_lock(hashtextextended('money-account-writes:v1', 0));
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

CREATE OR REPLACE FUNCTION public.settle_matured_earnings(
  p_limit INTEGER DEFAULT 5000
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry_count   INTEGER := 0;
  v_settled_cents BIGINT  := 0;
  v_creator_count INTEGER := 0;
  v_row           RECORD;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('money-account-writes:v1', 0));
  -- SKIP LOCKED so a second, overlapping run works on different rows rather
  -- than blocking behind the first — the job is safe to run concurrently.
  CREATE TEMP TABLE IF NOT EXISTS _matured (id UUID, creator_id UUID, amount_cents BIGINT)
    ON COMMIT DROP;
  DELETE FROM _matured;

  INSERT INTO _matured (id, creator_id, amount_cents)
  SELECT id, creator_id, amount_cents
  FROM public.creator_ledger
  WHERE state = 'pending'
    AND entry_type = 'earning'
    AND available_on IS NOT NULL
    AND available_on <= timezone('utc', now())
  ORDER BY available_on
  LIMIT p_limit
  FOR UPDATE SKIP LOCKED;

  SELECT COUNT(*)::int, COALESCE(SUM(amount_cents), 0)::bigint
  INTO v_entry_count, v_settled_cents
  FROM _matured;

  IF v_entry_count = 0 THEN
    RETURN json_build_object(
      'success', true, 'creators_settled', 0, 'cents_settled', 0, 'entries_settled', 0
    );
  END IF;

  UPDATE public.creator_ledger cl
    SET state = 'available', updated_at = timezone('utc', now())
    FROM _matured m
    WHERE cl.id = m.id;

  FOR v_row IN
    SELECT creator_id, SUM(amount_cents)::bigint AS total
    FROM _matured GROUP BY creator_id
  LOOP
    v_creator_count := v_creator_count + 1;
  END LOOP;

  -- Complete only transactions corresponding to the entries actually moved.
  UPDATE public.transactions t SET status = 'completed', updated_at = timezone('utc', now())
    WHERE t.status = 'pending' AND t.amount_cents > 0 AND EXISTS (
      SELECT 1 FROM _matured m JOIN public.creator_ledger cl ON cl.id = m.id
      WHERE t.user_id = cl.creator_id
        AND t.metadata->>'consumption_order_id' = cl.consumption_order_id::text
    );

  RETURN json_build_object(
    'success', true,
    'creators_settled', v_creator_count,
    'cents_settled', v_settled_cents,
    'entries_settled', v_entry_count
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.reverse_consumption_order(
  p_consumption_order_id UUID,
  p_reason               TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order    public.consumption_orders%ROWTYPE;
  v_entry    public.creator_ledger%ROWTYPE;
  v_fan_bal  BIGINT;
  v_case     TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('money-account-writes:v1', 0));
  SELECT * INTO v_order
  FROM public.consumption_orders
  WHERE id = p_consumption_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Unknown order');
  END IF;

  IF v_order.reversed_at IS NOT NULL THEN
    RETURN json_build_object('success', true, 'idempotent', true, 'order_id', v_order.id);
  END IF;

  SELECT * INTO v_entry
  FROM public.creator_ledger
  WHERE consumption_order_id = v_order.id AND entry_type = 'earning'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'No creator entry for order');
  END IF;

  -- Return the gross to the fan. The platform fee is reversed too — we do not
  -- keep commission on a sale that did not stand.
  INSERT INTO public.wallet_accounts (user_id, available_balance_cents, pending_balance_cents)
  VALUES (v_order.fan_id, v_order.gross_amount_cents, 0)
  ON CONFLICT (user_id) DO UPDATE
    SET available_balance_cents = public.wallet_accounts.available_balance_cents + EXCLUDED.available_balance_cents,
        updated_at = timezone('utc', now())
  RETURNING available_balance_cents INTO v_fan_bal;

  IF v_entry.state = 'pending' THEN
    v_case := 'clawback_pending';
    UPDATE public.creator_ledger
      SET state = 'reversed', updated_at = timezone('utc', now())
      WHERE id = v_entry.id;

  ELSIF v_entry.state = 'available' THEN
    v_case := 'clawback_available';
    UPDATE public.creator_ledger
      SET state = 'reversed', updated_at = timezone('utc', now())
      WHERE id = v_entry.id;

  ELSE
    -- Already paid out. Book the debt; it nets against future earnings.
    v_case := 'negative_adjustment';
    INSERT INTO public.creator_ledger (
      creator_id, entry_type, amount_cents, state,
      consumption_order_id, idempotency_key, note
    )
    VALUES (
      v_order.creator_id, 'adjustment', -v_entry.amount_cents, 'available',
      v_order.id, 'rev_' || v_order.id::text,
      'Reversal of an already-paid-out earning: ' || COALESCE(p_reason, 'no reason given')
    );


  END IF;

  -- Reversed income must not remain displayed as pending/completed revenue.
  UPDATE public.transactions SET status = 'failed', updated_at = timezone('utc', now())
    WHERE user_id = v_order.creator_id AND amount_cents > 0
      AND metadata->>'consumption_order_id' = v_order.id::text;

  INSERT INTO public.creator_ledger (
    creator_id, entry_type, amount_cents, state,
    consumption_order_id, idempotency_key, note
  )
  VALUES (
    v_order.creator_id, 'reversal', -v_entry.amount_cents, 'void',
    v_order.id, 'revlog_' || v_order.id::text, p_reason
  )
  ON CONFLICT (idempotency_key) DO NOTHING;

  UPDATE public.consumption_orders
    SET reversed_at = timezone('utc', now()), reversal_reason = p_reason
    WHERE id = v_order.id;

  INSERT INTO public.transactions (user_id, type, amount_cents, status, metadata)
  VALUES (
    v_order.fan_id, 'refund', v_order.gross_amount_cents, 'completed',
    jsonb_build_object(
      'consumption_order_id', v_order.id,
      'creator_id', v_order.creator_id,
      'reason', p_reason,
      'case', v_case
    )
  );

  -- Entitlements follow the money: a reversed PPV purchase must stop granting
  -- access, or a fan can refund every unlock and keep all of it.
  IF v_order.kind = 'ppv' AND v_order.reference_id IS NOT NULL THEN
    DELETE FROM public.purchases WHERE id = v_order.reference_id;
  END IF;

  -- The same has to hold for subscriptions, which are the larger amount and were
  -- previously left `active` through `current_period_end` — a refunded fan kept
  -- a month of access. Ending the period rather than only flagging `canceled` is
  -- what actually revokes it, since every read path gates on current_period_end.
  --
  -- Guarded on there being no LATER subscription order: reversing an old month
  -- must not claw back a period the fan has since paid for again.
  IF v_order.kind = 'subscription' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.consumption_orders co
      WHERE co.fan_id = v_order.fan_id
        AND co.creator_id = v_order.creator_id
        AND co.kind = 'subscription'
        AND co.reversed_at IS NULL
        AND co.created_at > v_order.created_at
    ) THEN
      UPDATE public.subscriptions
        SET status = 'canceled',
            cancelled_at = timezone('utc', now()),
            current_period_end = LEAST(current_period_end, timezone('utc', now()))
        WHERE subscriber_id = v_order.fan_id
          AND creator_id = v_order.creator_id;
    END IF;
  END IF;

  RETURN json_build_object(
    'success', true, 'idempotent', false,
    'order_id', v_order.id, 'case', v_case,
    'fan_balance_cents', v_fan_bal
  );
END;
$$;

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
  v_ledger_id  UUID;
  v_request_id UUID;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('money-account-writes:v1', 0));
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

  -- The creator ledger is the earned account; funded wallets are never used.
  SELECT COALESCE(SUM(amount_cents), 0) INTO v_earned
    FROM public.creator_ledger WHERE creator_id = p_creator_id AND state = 'available';
  v_balance := GREATEST(0, v_earned);
  IF v_balance < p_amount_cents THEN
    RETURN json_build_object(
      'success', false, 'error', 'Insufficient balance',
      'balance_cents', COALESCE(v_balance, 0)
    );
  END IF;

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
    'balance_cents', GREATEST(0, v_earned - p_amount_cents),
    'amount_cents', p_amount_cents,
    'status', 'requested'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.decide_withdrawal(
  p_request_id          UUID,
  p_decision            TEXT,
  p_external_reference  TEXT,
  p_reason              TEXT,
  p_admin_id            UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request  public.withdrawal_requests%ROWTYPE;
  v_method   public.creator_payout_methods%ROWTYPE;
  v_batch_id UUID;
  v_balance  BIGINT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('money-account-writes:v1', 0));
  IF p_decision NOT IN ('paid', 'rejected') THEN
    RETURN json_build_object('success', false, 'error', 'Invalid decision');
  END IF;

  SELECT * INTO v_request
  FROM public.withdrawal_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Unknown withdrawal');
  END IF;

  IF v_request.status <> 'requested' THEN
    IF v_request.status IS DISTINCT FROM p_decision
       OR (p_decision = 'paid' AND v_request.external_reference IS DISTINCT FROM p_external_reference) THEN
      RETURN json_build_object('success', false, 'error', 'Withdrawal decision conflicts with recorded result');
    END IF;
    RETURN json_build_object(
      'success', true, 'idempotent', true,
      'request_id', v_request.id,
      'status', v_request.status
    );
  END IF;

  IF p_decision = 'paid' THEN
    IF p_external_reference IS NULL OR p_external_reference = '' THEN
      RETURN json_build_object('success', false, 'error', 'Missing external reference');
    END IF;

    IF EXISTS (SELECT 1 FROM public.withdrawal_requests WHERE status = 'paid'
               AND external_reference = p_external_reference AND id <> v_request.id) THEN
      RETURN json_build_object('success', false, 'error', 'External payout reference already used');
    END IF;
    SELECT * INTO v_method FROM public.creator_payout_methods WHERE id = v_request.method_id;

    INSERT INTO public.payout_batches (
      period_start, period_end, status, rail, total_cents, creator_count,
      external_reference, notes, approved_at, paid_at
    )
    VALUES (
      v_request.created_at,
      GREATEST(v_request.created_at + interval '1 second', timezone('utc', now())),
      'paid',
      COALESCE(v_method.rail, 'paxum'),
      v_request.amount_cents,
      1,
      p_external_reference,
      p_reason,
      timezone('utc', now()),
      timezone('utc', now())
    )
    RETURNING id INTO v_batch_id;

    -- The negative reservation remains in the earned account after payment.
    UPDATE public.creator_ledger
      SET payout_batch_id = v_batch_id,
          note = 'Withdrawal paid: ' || p_external_reference,
          updated_at = timezone('utc', now())
      WHERE id = v_request.creator_ledger_id;

    UPDATE public.withdrawal_requests
      SET status = 'paid',
          payout_batch_id = v_batch_id,
          external_reference = p_external_reference,
          reason = p_reason,
          decided_by = p_admin_id,
          decided_at = timezone('utc', now()),
          updated_at = timezone('utc', now())
      WHERE id = v_request.id;

    UPDATE public.transactions
      SET status = 'completed',
          updated_at = timezone('utc', now())
      WHERE type = 'withdrawal'
        AND metadata->>'withdrawal_request_id' = v_request.id::text;

    RETURN json_build_object(
      'success', true, 'idempotent', false,
      'request_id', v_request.id,
      'status', 'paid',
      'payout_batch_id', v_batch_id
    );
  END IF;

  -- Rejection releases the earnings reservation only, never credits funded money.
  UPDATE public.creator_ledger
    SET state = 'void',
        note = 'Withdrawal rejected: ' || COALESCE(p_reason, 'no reason given'),
        updated_at = timezone('utc', now())
    WHERE id = v_request.creator_ledger_id;

  UPDATE public.withdrawal_requests
    SET status = 'rejected',
        reason = p_reason,
        decided_by = p_admin_id,
        decided_at = timezone('utc', now()),
        updated_at = timezone('utc', now())
    WHERE id = v_request.id;

  UPDATE public.transactions
    SET status = 'failed',
        updated_at = timezone('utc', now())
    WHERE type = 'withdrawal'
      AND metadata->>'withdrawal_request_id' = v_request.id::text;

  SELECT GREATEST(0, COALESCE(SUM(amount_cents), 0)) INTO v_balance
    FROM public.creator_ledger WHERE creator_id = v_request.creator_id AND state = 'available';
  RETURN json_build_object(
    'success', true, 'idempotent', false,
    'request_id', v_request.id,
    'status', 'rejected',
    'balance_cents', v_balance
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.refund_unspent_balance(
  p_user_id      UUID,
  p_amount_cents BIGINT,
  p_reason       TEXT,
  p_reference    TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance BIGINT;
  v_tx public.transactions%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('money-account-writes:v1', 0));
  IF p_amount_cents IS NULL OR p_amount_cents <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Invalid amount');
  END IF;
  IF p_reference IS NULL OR p_reference = '' THEN
    RETURN json_build_object('success', false, 'error', 'Missing reference');
  END IF;

  SELECT * INTO v_tx FROM public.transactions
    WHERE type = 'refund' AND metadata->>'external_reference' = p_reference LIMIT 1;
  IF FOUND THEN
    IF v_tx.user_id IS DISTINCT FROM p_user_id OR v_tx.amount_cents IS DISTINCT FROM -p_amount_cents
       OR v_tx.status IS DISTINCT FROM 'completed'
       OR v_tx.metadata->>'kind' IS DISTINCT FROM 'unspent_balance_return' THEN
      RETURN json_build_object('success', false, 'error', 'Refund reference conflicts with another intent');
    END IF;
    SELECT available_balance_cents INTO v_balance FROM public.wallet_accounts WHERE user_id = p_user_id;
    RETURN json_build_object('success', true, 'idempotent', true, 'balance_cents', v_balance);
  END IF;

  SELECT available_balance_cents INTO v_balance
  FROM public.wallet_accounts WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND OR COALESCE(v_balance, 0) < p_amount_cents THEN
    RETURN json_build_object(
      'success', false, 'error', 'Insufficient balance',
      'balance_cents', COALESCE(v_balance, 0)
    );
  END IF;

  UPDATE public.wallet_accounts
    SET available_balance_cents = available_balance_cents - p_amount_cents,
        updated_at = timezone('utc', now())
    WHERE user_id = p_user_id
    RETURNING available_balance_cents INTO v_balance;

  INSERT INTO public.transactions (user_id, type, amount_cents, status, metadata)
  VALUES (
    p_user_id, 'refund', -p_amount_cents, 'completed',
    jsonb_build_object(
      'kind', 'unspent_balance_return',
      'reason', p_reason,
      'external_reference', p_reference
    )
  );

  RETURN json_build_object('success', true, 'idempotent', false, 'balance_cents', v_balance);
END;
$$;

CREATE OR REPLACE FUNCTION public.credit_payram_deposit(
  p_reference_id  TEXT,
  p_filled_cents  BIGINT,
  p_state         TEXT,
  p_currency      TEXT DEFAULT NULL,
  p_network       TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order        public.payment_orders%ROWTYPE;
  v_new_balance  BIGINT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('money-account-writes:v1', 0));
  IF p_reference_id IS NULL OR p_reference_id = '' THEN
    RETURN json_build_object('success', false, 'error', 'Missing reference_id');
  END IF;

  SELECT * INTO v_order
  FROM public.payment_orders
  WHERE provider = 'payram' AND reference_id = p_reference_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Unknown order');
  END IF;

  IF p_currency IS NOT NULL
     AND public.normalize_payram_asset(p_currency)
         <> public.normalize_payram_asset(v_order.currency) THEN
    RETURN json_build_object('success', false, 'error', 'Currency mismatch');
  END IF;
  IF p_network IS NOT NULL
     AND public.normalize_payram_network(p_network)
         <> public.normalize_payram_network(v_order.network) THEN
    RETURN json_build_object('success', false, 'error', 'Network mismatch');
  END IF;

  IF v_order.credited_at IS NOT NULL THEN
    SELECT available_balance_cents INTO v_new_balance
    FROM public.wallet_accounts WHERE user_id = v_order.user_id;
    RETURN json_build_object(
      'success', true, 'idempotent', true,
      'order_id', v_order.id, 'balance_cents', COALESCE(v_new_balance, 0)
    );
  END IF;

  IF p_state NOT IN ('FILLED', 'OVER_FILLED') THEN
    UPDATE public.payment_orders
      SET state = p_state,
          filled_usd_cents = GREATEST(filled_usd_cents, COALESCE(p_filled_cents, 0)),
          updated_at = timezone('utc', now())
      WHERE id = v_order.id;
    RETURN json_build_object(
      'success', true, 'credited', false, 'order_id', v_order.id,
      'reason', 'non_terminal_state'
    );
  END IF;

  IF p_filled_cents IS NULL OR p_filled_cents <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Invalid filled amount');
  END IF;

  INSERT INTO public.wallet_accounts (user_id, available_balance_cents, pending_balance_cents)
  VALUES (v_order.user_id, p_filled_cents, 0)
  ON CONFLICT (user_id) DO UPDATE
    SET available_balance_cents = public.wallet_accounts.available_balance_cents + EXCLUDED.available_balance_cents,
        updated_at = timezone('utc', now())
  RETURNING available_balance_cents INTO v_new_balance;

  UPDATE public.payment_orders
    SET state = p_state,
        filled_usd_cents = p_filled_cents,
        credited_cents = p_filled_cents,
        credited_at = timezone('utc', now()),
        updated_at = timezone('utc', now())
    WHERE id = v_order.id;

  INSERT INTO public.transactions (user_id, type, amount_cents, status, metadata)
  VALUES (
    v_order.user_id, 'deposit', p_filled_cents, 'completed',
    jsonb_build_object(
      'payment_method', 'payram',
      'payram_reference_id', p_reference_id,
      'payment_order_id', v_order.id,
      'currency', v_order.currency,
      'network', v_order.network,
      'state', p_state
    )
  );

  RETURN json_build_object(
    'success', true, 'credited', true, 'idempotent', false,
    'order_id', v_order.id, 'balance_cents', v_new_balance
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.credit_nowpayments_deposit(
  p_user_id UUID,
  p_amount_cents INTEGER,
  p_payment_id TEXT,
  p_pay_currency TEXT,
  p_payment_status TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance BIGINT;
  v_tx public.transactions%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('money-account-writes:v1', 0));
  IF p_amount_cents IS NULL OR p_amount_cents <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Invalid amount');
  END IF;
  IF p_payment_id IS NULL OR p_payment_id = '' THEN
    RETURN json_build_object('success', false, 'error', 'Missing payment_id');
  END IF;

  SELECT * INTO v_tx FROM public.transactions WHERE type = 'deposit'
    AND metadata->>'nowpayments_payment_id' = p_payment_id LIMIT 1;
  IF FOUND THEN
    IF v_tx.user_id IS DISTINCT FROM p_user_id OR v_tx.amount_cents IS DISTINCT FROM p_amount_cents
       OR v_tx.metadata->>'pay_currency' IS DISTINCT FROM p_pay_currency
       OR v_tx.status IS DISTINCT FROM 'completed' THEN
      RETURN json_build_object('success', false, 'error', 'Payment id conflicts with another deposit');
    END IF;
    SELECT available_balance_cents INTO v_new_balance FROM public.wallet_accounts WHERE user_id = p_user_id;
    RETURN json_build_object('success', true, 'idempotent', true, 'balance_cents', v_new_balance);
  END IF;

  -- Atomic wallet increment — single statement, no read-then-write race.
  INSERT INTO public.wallet_accounts (user_id, available_balance_cents, pending_balance_cents)
  VALUES (p_user_id, p_amount_cents, 0)
  ON CONFLICT (user_id) DO UPDATE
    SET available_balance_cents = wallet_accounts.available_balance_cents + EXCLUDED.available_balance_cents,
        updated_at = timezone('utc', now())
  RETURNING available_balance_cents INTO v_new_balance;

    INSERT INTO public.transactions (user_id, type, amount_cents, status, metadata)
    VALUES (
      p_user_id,
      'deposit',
      p_amount_cents,
      'completed',
      jsonb_build_object(
        'payment_method', 'nowpayments',
        'nowpayments_payment_id', p_payment_id,
        'pay_currency', p_pay_currency,
        'payment_status', p_payment_status
      )
    );
  RETURN json_build_object(
    'success', true,
    'balance_cents', v_new_balance,
    'idempotent', false
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.recharge_wallet(
  p_user_id UUID, p_amount_cents INTEGER, p_idempotency_key TEXT DEFAULT NULL
) RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tx public.transactions%ROWTYPE;
  v_balance BIGINT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('money-account-writes:v1', 0));
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
CREATE OR REPLACE FUNCTION public.creator_earned_balances(p_creator_id UUID)
RETURNS JSON LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT json_build_object('available_cents', GREATEST(0,COALESCE(SUM(amount_cents) FILTER(WHERE state='available'),0)),
  'pending_cents', GREATEST(0,COALESCE(SUM(amount_cents) FILTER(WHERE state='pending'),0)),
  'debt_cents', GREATEST(0,-COALESCE(SUM(amount_cents) FILTER(WHERE state='available'),0)))
 FROM public.creator_ledger WHERE creator_id=p_creator_id
$$;
-- Unused legacy unjournaled credits must not bypass funded reconciliation.
CREATE OR REPLACE FUNCTION public.increment_wallet_available(p_user_id UUID,p_cents BIGINT)
RETURNS JSON LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 SELECT json_build_object('success',false,'error','Use an audited deposit operation')
$$;
CREATE OR REPLACE FUNCTION public.reconciliation_report()
RETURNS TABLE(identity TEXT,left_cents BIGINT,right_cents BIGINT,difference BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 WITH values_to_check AS (
 SELECT 'credited_deposits_match_orders'::text AS name,
  COALESCE((SELECT SUM(amount_cents) FROM public.transactions WHERE type='deposit' AND status='completed' AND metadata->>'payment_method'='payram'),0)::bigint AS a,
  COALESCE((SELECT SUM(credited_cents) FROM public.payment_orders WHERE credited_at IS NOT NULL),0)::bigint AS b
 UNION ALL SELECT 'consumption_splits_balance',
  COALESCE((SELECT SUM(gross_amount_cents) FROM public.consumption_orders WHERE reversed_at IS NULL),0)::bigint,
  COALESCE((SELECT SUM(platform_fee_cents+creator_net_cents) FROM public.consumption_orders WHERE reversed_at IS NULL),0)::bigint
 UNION ALL SELECT 'creator_earned_liability',
  (COALESCE((SELECT SUM(creator_net_cents) FROM public.consumption_orders WHERE reversed_at IS NULL),0)
   - COALESCE((SELECT SUM(amount_cents) FROM public.withdrawal_requests WHERE status IN ('requested','paid')),0))::bigint,
  COALESCE((SELECT SUM(amount_cents) FROM public.creator_ledger WHERE state IN ('pending','available')),0)::bigint
 UNION ALL SELECT 'funded_liability_matches_balances',
  (COALESCE((SELECT SUM(amount_cents) FROM public.transactions WHERE type='deposit' AND status='completed'),0)
   - COALESCE((SELECT SUM(gross_amount_cents) FROM public.consumption_orders WHERE reversed_at IS NULL),0)
   + COALESCE((SELECT SUM(amount_cents) FROM public.transactions WHERE type='refund' AND amount_cents<0 AND status='completed' AND metadata->>'kind'='unspent_balance_return'),0))::bigint,
  COALESCE((SELECT SUM(available_balance_cents) FROM public.wallet_accounts),0)::bigint
 UNION ALL SELECT 'payouts_match_ledger',
  COALESCE((SELECT SUM(amount_cents) FROM public.withdrawal_requests WHERE status='paid'),0)::bigint,
  COALESCE((SELECT SUM(-amount_cents) FROM public.creator_ledger WHERE entry_type='payout' AND payout_batch_id IS NOT NULL),0)::bigint
 ) SELECT name,a,b,a-b FROM values_to_check
$$;
DO $$ DECLARE p record; BEGIN
 FOR p IN SELECT oid::regprocedure AS signature FROM pg_proc WHERE pronamespace='public'::regnamespace
  AND proname=ANY(ARRAY['spend_wallet','spend_wallet_on_ppv','spend_wallet_on_tip','spend_wallet_on_subscription',
   'settle_matured_earnings','reverse_consumption_order','request_withdrawal','decide_withdrawal',
   'refund_unspent_balance','credit_payram_deposit','credit_nowpayments_deposit','recharge_wallet',
   'creator_earned_balances','increment_wallet_available','reconciliation_report']) LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',p.signature);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',p.signature);
 END LOOP;
END; $$;
-- Retire obsolete grant/spend writers, including all historical overloads.
DO $$ DECLARE p record; BEGIN
 FOR p IN SELECT oid::regprocedure AS signature FROM pg_proc WHERE pronamespace='public'::regnamespace
  AND proname IN ('unlock_ppv','rpc_purchase_post') LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',p.signature);
 END LOOP;
END; $$;
-- A read helper must neither expose another user's balance nor create wallets.
-- SECURITY INVOKER preserves the caller's RLS restrictions instead of using the owner.
CREATE OR REPLACE FUNCTION public.rpc_get_wallet_balance(p_user_id UUID DEFAULT auth.uid())
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public AS $$
DECLARE v_balance bigint;
BEGIN
 IF p_user_id IS NULL OR (current_user NOT IN ('postgres','service_role','supabase_admin')
                         AND p_user_id IS DISTINCT FROM auth.uid()) THEN
  RETURN jsonb_build_object('success',false,'error','Wallet access denied');
 END IF;
 SELECT available_balance_cents INTO v_balance FROM public.wallet_accounts WHERE user_id=p_user_id;
 RETURN jsonb_build_object('success',true,'balance_cents',COALESCE(v_balance,0));
END; $$;
REVOKE ALL ON FUNCTION public.rpc_get_wallet_balance(UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_get_wallet_balance(UUID) TO authenticated,service_role;
COMMIT;
