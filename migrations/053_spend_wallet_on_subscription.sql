-- 053: Subscriptions join the atomic spend wrappers.
--
-- PPV and tips have always granted their entitlement inside the same
-- transaction as the debit (`spend_wallet_on_ppv` / `_on_tip`), which is what
-- makes a retry naturally idempotent. Subscriptions did not: the route charged
-- through `spend_wallet` and then wrote `subscriptions` over a separate
-- connection, leaving a window where the debit had committed and the grant had
-- not.
--
-- Three review rounds tried to close that window from the route by choosing a
-- better idempotency key, and each key failed for its own reason:
--
--   * the new period end   — derived from `Date.now()`, so concurrent requests
--                            produced different keys and both charged
--   * the replaced period  — read from `subscriptions`, which fans can delete
--                            or edit under `subscriptions_delete_own` /
--                            `subscriptions_update_own`, walking the key back
--                            onto one already paid
--   * a count of orders    — self-incrementing: the successful charge changes
--                            the count, so the retry after a failed grant
--                            builds a new key and charges again
--
-- No key works, because the thing being made idempotent spans two transactions.
-- This function removes the window instead of naming it: the debit, the creator
-- credit and the subscription row commit together or not at all.
--
-- Concurrency is handled by a transaction-scoped advisory lock on (fan,
-- creator) taken before the "already subscribed" check. Without it, two
-- in-flight requests both read "not subscribed" and both charge — the check has
-- to be serialised against itself, not just against the wallet debit.

-- The user column on `subscriptions` is resolved at runtime in TypeScript
-- (`resolveSubscriptionUserColumn`) because it has varied historically. SQL
-- cannot do that cheaply, so assert the canonical name from `005_paywall.sql`
-- rather than silently writing the wrong column.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'subscriptions'
      AND column_name = 'subscriber_id'
  ) THEN
    RAISE EXCEPTION
      'subscriptions.subscriber_id is missing — spend_wallet_on_subscription assumes it';
  END IF;
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
BEGIN
  IF p_period_days IS NULL OR p_period_days <= 0 THEN
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

  v_spend := public.spend_wallet(
    p_fan_id, p_creator_id, 'subscription', p_price_cents, p_platform_fee_bps,
    p_idempotency_key, 'subscription', NULL, p_buyer_country, p_buyer_region,
    p_available_on
  );

  IF (v_spend->>'success')::boolean IS NOT TRUE THEN
    RETURN v_spend;
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

REVOKE ALL ON FUNCTION public.spend_wallet_on_subscription(
  UUID, UUID, BIGINT, INTEGER, TEXT, INTEGER, TEXT, TEXT, TIMESTAMPTZ
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.spend_wallet_on_subscription(
  UUID, UUID, BIGINT, INTEGER, TEXT, INTEGER, TEXT, TEXT, TIMESTAMPTZ
) TO service_role;

DO $$
BEGIN
  RAISE NOTICE 'spend_wallet_on_subscription: %', (
    SELECT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'spend_wallet_on_subscription')
  );
END;
$$;
