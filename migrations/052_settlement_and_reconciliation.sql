-- Migration 052: Settlement, reversal and reconciliation
--
-- 051 built the ledger. This closes the loop on it:
--
--   * pending creator earnings mature into available balance on a schedule
--   * a purchase can be reversed correctly, including the awkward case where
--     the creator has already been paid
--   * unspent fan balance can be returned when we close an account
--   * the accounting identities can be checked by query rather than by belief
--
-- Depends on: 051

-- ── 1. settle_matured_earnings ──────────────────────────────────────────────
-- Moves pending creator earnings to available once their hold period elapses.
--
-- Batched and idempotent: it only touches rows still in `pending` whose
-- available_on has passed, so running it twice, or running it after a partial
-- failure, converges on the same state instead of double-crediting.
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
    UPDATE public.wallet_accounts
      SET pending_balance_cents   = pending_balance_cents - v_row.total,
          available_balance_cents = available_balance_cents + v_row.total,
          updated_at = timezone('utc', now())
      WHERE user_id = v_row.creator_id;
    v_creator_count := v_creator_count + 1;
  END LOOP;

  -- Keep the legacy transaction log consistent with the ledger, so the
  -- creator's earnings history does not show entries stuck at 'pending'
  -- forever after the ledger has already released them.
  UPDATE public.transactions
    SET status = 'completed', updated_at = timezone('utc', now())
    WHERE status = 'pending'
      AND available_on IS NOT NULL
      AND available_on <= timezone('utc', now())
      AND type IN ('ppv_revenue', 'subscription', 'tip')
      AND amount_cents > 0;

  RETURN json_build_object(
    'success', true,
    'creators_settled', v_creator_count,
    'cents_settled', v_settled_cents,
    'entries_settled', v_entry_count
  );
END;
$$;

-- ── 2. reverse_consumption_order ────────────────────────────────────────────
-- Refunds a purchase and unwinds the creator's side of it.
--
-- Three cases, and the third is the one that gets skipped in naive
-- implementations:
--
--   pending   — claw straight back out of the creator's pending balance
--   available — claw back out of available balance
--   paid      — the money has already left for Paxum. There is nothing to claw
--               back, so the reversal is booked as a negative adjustment that
--               nets against the creator's next earnings. Pretending this case
--               does not exist is how a ledger goes negative silently.
--
-- The fan is always made whole from platform funds either way, because the
-- alternative is telling a fan their refund depends on their creator's payout
-- schedule.
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
    UPDATE public.wallet_accounts
      SET pending_balance_cents = pending_balance_cents - v_entry.amount_cents,
          updated_at = timezone('utc', now())
      WHERE user_id = v_order.creator_id;
    UPDATE public.creator_ledger
      SET state = 'reversed', updated_at = timezone('utc', now())
      WHERE id = v_entry.id;

  ELSIF v_entry.state = 'available' THEN
    v_case := 'clawback_available';
    UPDATE public.wallet_accounts
      SET available_balance_cents = available_balance_cents - v_entry.amount_cents,
          updated_at = timezone('utc', now())
      WHERE user_id = v_order.creator_id;
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

    -- The wallet has to move with the ledger. `creator_ledger_matches_wallets`
    -- sums pending+available ledger rows against the denormalised wallet
    -- balances, so booking the debt in the ledger alone leaves that identity
    -- permanently non-zero — and the first thing it would break is the reversal
    -- path Soft Beta exists to exercise. The balance is allowed to go negative:
    -- that IS the debt, and it is what "nets against future earnings" means,
    -- since the next settlement adds into it.
    UPDATE public.wallet_accounts
      SET available_balance_cents = available_balance_cents - v_entry.amount_cents,
          updated_at = timezone('utc', now())
      WHERE user_id = v_order.creator_id;
  END IF;

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

-- ── 3. refund_unspent_balance ───────────────────────────────────────────────
-- Returns unspent closed-loop balance to a fan, off-platform.
--
-- The Terms make the wallet non-withdrawable, so this exists only for the cases
-- the Terms carve out: we close an account without cause, or we discontinue the
-- service. It debits the balance and records the intent; the actual transfer
-- happens off-platform on the same rail the money arrived on, because there is
-- no code path that sends money to a fan, and there must not be one.
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
BEGIN
  IF p_amount_cents IS NULL OR p_amount_cents <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Invalid amount');
  END IF;
  IF p_reference IS NULL OR p_reference = '' THEN
    RETURN json_build_object('success', false, 'error', 'Missing reference');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.transactions
    WHERE user_id = p_user_id
      AND type = 'refund'
      AND metadata->>'external_reference' = p_reference
  ) THEN
    SELECT available_balance_cents INTO v_balance
    FROM public.wallet_accounts WHERE user_id = p_user_id;
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

-- ── 4. Reconciliation ───────────────────────────────────────────────────────
-- The identities that must hold every settlement cycle. Each row reports a
-- difference; any non-zero difference is a stop-the-line event, and every one
-- of them must be explainable line by line.
CREATE OR REPLACE FUNCTION public.reconciliation_report()
RETURNS TABLE (
  identity     TEXT,
  left_cents   BIGINT,
  right_cents  BIGINT,
  difference   BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- 1. Deposits credited == the sum of what payment orders say arrived.
  --    Any gap means a webhook credited an amount the order does not record.
  SELECT
    'credited_deposits_match_orders'::text,
    COALESCE((SELECT SUM(amount_cents) FROM public.transactions
              WHERE type = 'deposit' AND status = 'completed'
                AND metadata->>'payment_method' = 'payram'), 0)::bigint,
    COALESCE((SELECT SUM(credited_cents) FROM public.payment_orders
              WHERE credited_at IS NOT NULL), 0)::bigint,
    COALESCE((SELECT SUM(amount_cents) FROM public.transactions
              WHERE type = 'deposit' AND status = 'completed'
                AND metadata->>'payment_method' = 'payram'), 0)::bigint
      - COALESCE((SELECT SUM(credited_cents) FROM public.payment_orders
                  WHERE credited_at IS NOT NULL), 0)::bigint

  UNION ALL

  -- 2. Every sale splits exactly into commission plus creator share.
  SELECT
    'consumption_splits_balance'::text,
    COALESCE((SELECT SUM(gross_amount_cents) FROM public.consumption_orders
              WHERE reversed_at IS NULL), 0)::bigint,
    COALESCE((SELECT SUM(platform_fee_cents + creator_net_cents) FROM public.consumption_orders
              WHERE reversed_at IS NULL), 0)::bigint,
    COALESCE((SELECT SUM(gross_amount_cents - platform_fee_cents - creator_net_cents)
              FROM public.consumption_orders WHERE reversed_at IS NULL), 0)::bigint

  UNION ALL

  -- 3. What creators are owed per the ledger == the denormalised wallet
  --    balances. These drift the moment a balance is written outside the RPCs.
  SELECT
    'creator_ledger_matches_wallets'::text,
    COALESCE((SELECT SUM(amount_cents) FROM public.creator_ledger
              WHERE state IN ('pending', 'available')), 0)::bigint,
    COALESCE((SELECT SUM(wa.pending_balance_cents + wa.available_balance_cents)
              FROM public.wallet_accounts wa
              JOIN public.profiles p ON p.id = wa.user_id
              WHERE p.role = 'creator'), 0)::bigint,
    COALESCE((SELECT SUM(amount_cents) FROM public.creator_ledger
              WHERE state IN ('pending', 'available')), 0)::bigint
      - COALESCE((SELECT SUM(wa.pending_balance_cents + wa.available_balance_cents)
                  FROM public.wallet_accounts wa
                  JOIN public.profiles p ON p.id = wa.user_id
                  WHERE p.role = 'creator'), 0)::bigint

  UNION ALL

  -- 4. Deferred revenue: everything taken in, minus everything spent, minus
  --    everything returned, is what we still owe fans. This is the liability
  --    figure — it is NOT income, and it is the number that gets misstated if
  --    top-ups are ever booked as revenue.
  SELECT
    'fan_liability_matches_balances'::text,
    (COALESCE((SELECT SUM(credited_cents) FROM public.payment_orders WHERE credited_at IS NOT NULL), 0)
     - COALESCE((SELECT SUM(gross_amount_cents) FROM public.consumption_orders WHERE reversed_at IS NULL), 0)
     - COALESCE((SELECT SUM(-amount_cents) FROM public.transactions
                 WHERE type = 'refund' AND amount_cents < 0), 0))::bigint,
    COALESCE((SELECT SUM(wa.available_balance_cents)
              FROM public.wallet_accounts wa
              JOIN public.profiles p ON p.id = wa.user_id
              WHERE p.role <> 'creator'), 0)::bigint,
    (COALESCE((SELECT SUM(credited_cents) FROM public.payment_orders WHERE credited_at IS NOT NULL), 0)
     - COALESCE((SELECT SUM(gross_amount_cents) FROM public.consumption_orders WHERE reversed_at IS NULL), 0)
     - COALESCE((SELECT SUM(-amount_cents) FROM public.transactions
                 WHERE type = 'refund' AND amount_cents < 0), 0)
     - COALESCE((SELECT SUM(wa.available_balance_cents)
                 FROM public.wallet_accounts wa
                 JOIN public.profiles p ON p.id = wa.user_id
                 WHERE p.role <> 'creator'), 0))::bigint;
$$;

-- Revenue actually earned in a period, for the books. Recognised at
-- consumption, never at top-up.
CREATE OR REPLACE FUNCTION public.revenue_report(
  p_from TIMESTAMPTZ,
  p_to   TIMESTAMPTZ
)
RETURNS TABLE (
  kind                TEXT,
  order_count         BIGINT,
  gross_cents         BIGINT,
  platform_fee_cents  BIGINT,
  creator_net_cents   BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    co.kind,
    COUNT(*)::bigint,
    SUM(co.gross_amount_cents)::bigint,
    SUM(co.platform_fee_cents)::bigint,
    SUM(co.creator_net_cents)::bigint
  FROM public.consumption_orders co
  WHERE co.created_at >= p_from
    AND co.created_at < p_to
    AND co.reversed_at IS NULL
  GROUP BY co.kind;
$$;

-- Sales by buyer jurisdiction, for economic-nexus threshold monitoring. The
-- point is to see a threshold coming, not to discover afterwards that it was
-- crossed months ago.
CREATE OR REPLACE FUNCTION public.nexus_report(
  p_from TIMESTAMPTZ,
  p_to   TIMESTAMPTZ
)
RETURNS TABLE (
  country        TEXT,
  region         TEXT,
  order_count    BIGINT,
  gross_cents    BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(co.buyer_country, 'UNKNOWN'),
    COALESCE(co.buyer_region, 'UNKNOWN'),
    COUNT(*)::bigint,
    SUM(co.gross_amount_cents)::bigint
  FROM public.consumption_orders co
  WHERE co.created_at >= p_from
    AND co.created_at < p_to
    AND co.reversed_at IS NULL
  GROUP BY 1, 2
  ORDER BY 4 DESC;
$$;

-- ── 5. Permissions ──────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.settle_matured_earnings(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.settle_matured_earnings(INTEGER) TO service_role;

REVOKE ALL ON FUNCTION public.reverse_consumption_order(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reverse_consumption_order(UUID, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.refund_unspent_balance(UUID, BIGINT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refund_unspent_balance(UUID, BIGINT, TEXT, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.reconciliation_report() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reconciliation_report() TO service_role;

REVOKE ALL ON FUNCTION public.revenue_report(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revenue_report(TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;

REVOKE ALL ON FUNCTION public.nexus_report(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.nexus_report(TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;

-- ── 6. Verification ─────────────────────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration 052 Verification:';
  RAISE NOTICE 'settle_matured_earnings:    %', (SELECT EXISTS (SELECT 1 FROM pg_proc WHERE proname='settle_matured_earnings'));
  RAISE NOTICE 'reverse_consumption_order:  %', (SELECT EXISTS (SELECT 1 FROM pg_proc WHERE proname='reverse_consumption_order'));
  RAISE NOTICE 'refund_unspent_balance:     %', (SELECT EXISTS (SELECT 1 FROM pg_proc WHERE proname='refund_unspent_balance'));
  RAISE NOTICE 'reconciliation_report:      %', (SELECT EXISTS (SELECT 1 FROM pg_proc WHERE proname='reconciliation_report'));
  RAISE NOTICE '========================================';
END $$;
