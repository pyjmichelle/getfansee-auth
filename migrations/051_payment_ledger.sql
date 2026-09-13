-- Migration 051: Payment ledger on a deferred-revenue model
--
-- The existing money model is a balance (`wallet_accounts`) plus a flat event
-- log (`transactions`). That is enough to show a user their history and not
-- nearly enough to close a set of books. It cannot answer:
--
--   * how much of the USDC we hold is customer money we still owe (liability)
--     versus commission we have actually earned (revenue)
--   * what commission rate applied to a given sale six weeks ago
--   * which creator earnings belong to which payout batch
--   * whether on-chain receipts equal credited deposits
--
-- This migration adds the four tables that make those answerable, and moves the
-- money movements into database functions so they are atomic instead of being
-- four sequential round trips from a route handler that can die halfway.
--
-- ACCOUNTING MODEL
--
--   Fan tops up      -> DEFERRED REVENUE (a liability). Not income.
--   Fan spends       -> liability decreases; platform fee becomes REVENUE;
--                       creator share becomes a PAYABLE (pending).
--   Pending matures  -> payable moves pending -> available. Still a liability.
--   Batch paid out   -> payable extinguished.
--
-- Recognising revenue at top-up would overstate income by the entire unspent
-- balance and would misstate what we owe. This is the single most consequential
-- decision in the whole ledger, hence it is enforced structurally: nothing in
-- this migration can write revenue at deposit time.
--
-- Depends on: 018 (wallet_accounts, transactions), 044 (transactions.type)

-- ── 0. Extend transactions.type for the reversal/refund vocabulary ──────────
ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_type_check;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_type_check
  CHECK (type IN (
    'deposit',
    'withdrawal',
    'subscription',
    'ppv_purchase',
    'ppv_unlock',
    'ppv_revenue',
    'commission',
    'payout',
    'tip',
    'refund',
    'adjustment'
  ));

-- ── 1. Commission-free window for Founding Creators ─────────────────────────
-- 046 grants the Founding Creator flag but records no window, so the promised
-- 0% commission period had nowhere to live. The fee resolver reads this column;
-- it is set operationally when Beta payments launch, because the window starts
-- then rather than at KYC time.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS commission_free_until timestamptz;

COMMENT ON COLUMN public.profiles.commission_free_until IS
  'End of the Founding Creator 0% commission window. NULL = standard rate applies.';

-- ── 2. payment_orders — money in ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payment_orders (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  provider             text NOT NULL DEFAULT 'payram',
  -- The provider's own payment identifier. Sole idempotency key for crediting.
  reference_id         text NOT NULL,

  -- What we asked for vs. what actually arrived. They differ on under- and
  -- overpayment, which on a crypto rail is normal rather than exceptional.
  amount_usd_cents     bigint NOT NULL CHECK (amount_usd_cents > 0),
  filled_usd_cents     bigint NOT NULL DEFAULT 0 CHECK (filled_usd_cents >= 0),

  currency             text NOT NULL DEFAULT 'USDC',
  network              text NOT NULL DEFAULT 'BASE',

  state                text NOT NULL DEFAULT 'OPEN'
                         CHECK (state IN ('OPEN', 'PARTIALLY_FILLED', 'FILLED', 'OVER_FILLED', 'CANCELLED', 'EXPIRED')),

  -- Set exactly once, by credit_payram_deposit. Its nullness is the guard that
  -- makes redelivery of a webhook a no-op.
  credited_at          timestamptz,
  credited_cents       bigint NOT NULL DEFAULT 0 CHECK (credited_cents >= 0),

  -- Where the buyer was. Needed for sales-tax nexus monitoring long before we
  -- know whether we owe anything, because it cannot be reconstructed later.
  buyer_country        text,
  buyer_region         text,

  -- Reserved. Counsel has not yet decided whether a top-up is a single-purpose
  -- voucher (taxable here) or multi-purpose (taxable at consumption). Fields
  -- exist at BOTH ends precisely because the wrong guess is unrecoverable.
  tax_amount_cents     bigint,
  tax_jurisdiction     text,

  metadata             jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at           timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at           timestamptz NOT NULL DEFAULT timezone('utc', now()),

  CONSTRAINT uq_payment_orders_provider_reference UNIQUE (provider, reference_id)
);

COMMENT ON TABLE public.payment_orders IS
  'Money in. A credited order is deferred revenue (liability), never income.';

CREATE INDEX IF NOT EXISTS idx_payment_orders_user
  ON public.payment_orders (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_orders_state
  ON public.payment_orders (state, created_at DESC);

ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payment_orders_select_own" ON public.payment_orders;
CREATE POLICY "payment_orders_select_own"
  ON public.payment_orders FOR SELECT
  USING (auth.uid() = user_id);

-- ── 3. consumption_orders — money spent in-platform ─────────────────────────
CREATE TABLE IF NOT EXISTS public.consumption_orders (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fan_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  creator_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  kind                 text NOT NULL CHECK (kind IN ('subscription', 'ppv', 'tip')),

  gross_amount_cents   bigint NOT NULL CHECK (gross_amount_cents > 0),

  -- Snapshot, not a lookup. The rate that applied at the moment of sale must
  -- survive any later change to the platform's pricing, or historical revenue
  -- silently rewrites itself.
  platform_fee_bps     integer NOT NULL CHECK (platform_fee_bps BETWEEN 0 AND 10000),
  platform_fee_cents   bigint NOT NULL CHECK (platform_fee_cents >= 0),
  creator_net_cents    bigint NOT NULL CHECK (creator_net_cents >= 0),

  -- Points at purchases.id / tips.id / subscriptions.id for cross-referencing.
  reference_type       text,
  reference_id         uuid,

  idempotency_key      text NOT NULL UNIQUE,

  buyer_country        text,
  buyer_region         text,

  tax_amount_cents     bigint,
  tax_jurisdiction     text,

  reversed_at          timestamptz,
  reversal_reason      text,

  created_at           timestamptz NOT NULL DEFAULT timezone('utc', now()),

  CONSTRAINT consumption_orders_split_balances
    CHECK (platform_fee_cents + creator_net_cents = gross_amount_cents),
  CONSTRAINT consumption_orders_no_self_purchase
    CHECK (fan_id <> creator_id)
);

COMMENT ON TABLE public.consumption_orders IS
  'Money spent. The platform fee here is the only place revenue is recognised.';

CREATE INDEX IF NOT EXISTS idx_consumption_orders_fan
  ON public.consumption_orders (fan_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_consumption_orders_creator
  ON public.consumption_orders (creator_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_consumption_orders_region
  ON public.consumption_orders (buyer_country, buyer_region, created_at DESC);

ALTER TABLE public.consumption_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "consumption_orders_select_party" ON public.consumption_orders;
CREATE POLICY "consumption_orders_select_party"
  ON public.consumption_orders FOR SELECT
  USING (auth.uid() = fan_id OR auth.uid() = creator_id);

-- ── 4. payout_batches — creator settlement runs ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.payout_batches (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start       timestamptz NOT NULL,
  period_end         timestamptz NOT NULL,
  status             text NOT NULL DEFAULT 'draft'
                       CHECK (status IN ('draft', 'approved', 'paid', 'failed', 'cancelled')),
  rail               text NOT NULL DEFAULT 'paxum',
  total_cents        bigint NOT NULL DEFAULT 0,
  creator_count      integer NOT NULL DEFAULT 0,
  external_reference text,
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT timezone('utc', now()),
  approved_at        timestamptz,
  paid_at            timestamptz,

  CONSTRAINT payout_batches_period_ordered CHECK (period_end > period_start)
);

ALTER TABLE public.payout_batches ENABLE ROW LEVEL SECURITY;
-- No policies: back-office data, service role only.

-- ── 5. creator_ledger — double-entry-ish record of what we owe creators ─────
CREATE TABLE IF NOT EXISTS public.creator_ledger (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  entry_type            text NOT NULL
                          CHECK (entry_type IN ('earning', 'reversal', 'payout', 'adjustment')),

  -- Signed. Earnings positive, reversals and payouts negative. The sum over a
  -- creator's non-reversed entries is what we owe them.
  amount_cents          bigint NOT NULL,

  state                 text NOT NULL DEFAULT 'pending'
                          CHECK (state IN ('pending', 'available', 'paid', 'reversed', 'void')),

  consumption_order_id  uuid REFERENCES public.consumption_orders(id) ON DELETE SET NULL,
  payout_batch_id       uuid REFERENCES public.payout_batches(id) ON DELETE SET NULL,

  -- When a pending earning becomes withdrawable.
  available_on          timestamptz,

  idempotency_key       text UNIQUE,
  note                  text,

  created_at            timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at            timestamptz NOT NULL DEFAULT timezone('utc', now())
);

COMMENT ON TABLE public.creator_ledger IS
  'What the platform owes each creator, entry by entry. wallet_accounts holds '
  'the denormalised running balance; this table is the authority.';

CREATE INDEX IF NOT EXISTS idx_creator_ledger_creator
  ON public.creator_ledger (creator_id, state, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_creator_ledger_maturing
  ON public.creator_ledger (available_on)
  WHERE state = 'pending';
CREATE INDEX IF NOT EXISTS idx_creator_ledger_batch
  ON public.creator_ledger (payout_batch_id)
  WHERE payout_batch_id IS NOT NULL;

ALTER TABLE public.creator_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "creator_ledger_select_own" ON public.creator_ledger;
CREATE POLICY "creator_ledger_select_own"
  ON public.creator_ledger FOR SELECT
  USING (auth.uid() = creator_id);

-- ── 6. open_payment_order ───────────────────────────────────────────────────
-- Records intent before the fan is sent to the payment provider, so an
-- abandoned payment is visible as OPEN rather than leaving no trace.
CREATE OR REPLACE FUNCTION public.open_payment_order(
  p_user_id        UUID,
  p_provider       TEXT,
  p_reference_id   TEXT,
  p_amount_cents   BIGINT,
  p_currency       TEXT,
  p_network        TEXT,
  p_buyer_country  TEXT,
  p_buyer_region   TEXT,
  p_metadata       JSONB DEFAULT '{}'::jsonb
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF p_amount_cents IS NULL OR p_amount_cents <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Invalid amount');
  END IF;
  IF p_reference_id IS NULL OR p_reference_id = '' THEN
    RETURN json_build_object('success', false, 'error', 'Missing reference_id');
  END IF;

  INSERT INTO public.payment_orders (
    user_id, provider, reference_id, amount_usd_cents,
    currency, network, buyer_country, buyer_region, metadata
  )
  VALUES (
    p_user_id, p_provider, p_reference_id, p_amount_cents,
    COALESCE(p_currency, 'USDC'), COALESCE(p_network, 'BASE'),
    p_buyer_country, p_buyer_region, COALESCE(p_metadata, '{}'::jsonb)
  )
  ON CONFLICT (provider, reference_id) DO UPDATE
    SET updated_at = timezone('utc', now())
  RETURNING id INTO v_id;

  RETURN json_build_object('success', true, 'order_id', v_id);
END;
$$;

-- ── 7. credit_payram_deposit ────────────────────────────────────────────────
-- The one place a deposit may be credited.
--
-- Idempotency is a row lock plus a nullable `credited_at`, not a
-- SELECT-then-INSERT: the provider will redeliver, and two deliveries handled
-- concurrently must not both pass a check that neither has yet invalidated.
-- FOR UPDATE serialises them inside a single transaction; the loser sees a
-- non-null credited_at and returns without moving money.
--
-- Only terminal states credit. PARTIALLY_FILLED is recorded and left for a
-- human, because guessing whether a partial payment is "close enough" is how
-- ledgers stop balancing.
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

  -- Currency/network must match what the order was opened for. A deposit in
  -- something else is not this order being paid.
  IF p_currency IS NOT NULL AND upper(p_currency) <> upper(v_order.currency) THEN
    RETURN json_build_object('success', false, 'error', 'Currency mismatch');
  END IF;
  IF p_network IS NOT NULL AND upper(p_network) <> upper(v_order.network) THEN
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

  -- Credit what actually arrived, not what was requested. An overpayment is
  -- the fan's money and belongs in their balance; crediting the requested
  -- amount instead would quietly convert the difference into platform income.
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

-- ── 8. spend_wallet ─────────────────────────────────────────────────────────
-- The one place wallet balance may be spent. Replaces the four-round-trip
-- deduct/insert/insert/upsert sequences in /api/tip, /api/subscribe and
-- unlockPost, each of which could leave a fan debited and a creator uncredited
-- if the process died between statements.
--
-- Order of operations matters: the consumption order is inserted FIRST, so a
-- duplicate idempotency key aborts before any balance moves.
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

  -- Already processed? Return the same answer rather than charging twice.
  SELECT id INTO v_order_id
  FROM public.consumption_orders
  WHERE idempotency_key = p_idempotency_key;

  IF FOUND THEN
    SELECT available_balance_cents INTO v_new_balance
    FROM public.wallet_accounts WHERE user_id = p_fan_id;
    RETURN json_build_object(
      'success', true, 'idempotent', true,
      'consumption_order_id', v_order_id,
      'balance_after_cents', COALESCE(v_new_balance, 0)
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

  BEGIN
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
  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO v_order_id FROM public.consumption_orders
    WHERE idempotency_key = p_idempotency_key;
    RETURN json_build_object(
      'success', true, 'idempotent', true,
      'consumption_order_id', v_order_id,
      'balance_after_cents', v_balance
    );
  END;

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
    'creator_net_cents', v_net_cents
  );
END;
$$;

-- ── 9. Purchase wrappers — money and entitlement in one transaction ─────────
--
-- Charging and granting must commit together. Route-level sequencing cannot
-- achieve that: charge-then-grant can take a fan's money and give them nothing
-- if the grant fails, and grant-then-charge gives content away for free.
--
-- These wrappers call spend_wallet and then write the entitlement inside the
-- same transaction. If the entitlement insert raises, the whole thing —
-- including the debit and the creator credit — rolls back.

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
  v_spend        JSON;
  v_purchase_id  UUID;
  v_balance      BIGINT;
BEGIN
  -- Already unlocked: return success without charging again. The (fan_id,
  -- post_id) unique constraint is the durable guard; this is the fast path.
  SELECT id INTO v_purchase_id
  FROM public.purchases WHERE fan_id = p_fan_id AND post_id = p_post_id;

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
    p_fan_id, p_creator_id, 'ppv', p_price_cents, p_platform_fee_bps,
    p_idempotency_key, 'purchase', NULL, p_buyer_country, p_buyer_region,
    p_available_on
  );

  IF (v_spend->>'success')::boolean IS NOT TRUE THEN
    RETURN v_spend;
  END IF;

  INSERT INTO public.purchases (fan_id, post_id, paid_amount_cents, idempotency_key)
  VALUES (p_fan_id, p_post_id, p_price_cents, p_idempotency_key)
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
BEGIN
  SELECT id INTO v_tip_id FROM public.tips WHERE idempotency_key = p_idempotency_key;

  IF FOUND THEN
    SELECT available_balance_cents INTO v_balance
    FROM public.wallet_accounts WHERE user_id = p_fan_id;
    RETURN json_build_object(
      'success', true, 'idempotent', true,
      'tip_id', v_tip_id,
      'balance_after_cents', COALESCE(v_balance, 0)
    );
  END IF;

  v_spend := public.spend_wallet(
    p_fan_id, p_creator_id, 'tip', p_amount_cents, p_platform_fee_bps,
    p_idempotency_key, 'tip', NULL, p_buyer_country, p_buyer_region,
    p_available_on
  );

  IF (v_spend->>'success')::boolean IS NOT TRUE THEN
    RETURN v_spend;
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

-- ── 10. Permissions ─────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.open_payment_order(UUID, TEXT, TEXT, BIGINT, TEXT, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.open_payment_order(UUID, TEXT, TEXT, BIGINT, TEXT, TEXT, TEXT, TEXT, JSONB) TO service_role;

REVOKE ALL ON FUNCTION public.credit_payram_deposit(TEXT, BIGINT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.credit_payram_deposit(TEXT, BIGINT, TEXT, TEXT, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.spend_wallet(UUID, UUID, TEXT, BIGINT, INTEGER, TEXT, TEXT, UUID, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.spend_wallet(UUID, UUID, TEXT, BIGINT, INTEGER, TEXT, TEXT, UUID, TEXT, TEXT, TIMESTAMPTZ) TO service_role;

REVOKE ALL ON FUNCTION public.spend_wallet_on_ppv(UUID, UUID, UUID, BIGINT, INTEGER, TEXT, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.spend_wallet_on_ppv(UUID, UUID, UUID, BIGINT, INTEGER, TEXT, TEXT, TEXT, TIMESTAMPTZ) TO service_role;

REVOKE ALL ON FUNCTION public.spend_wallet_on_tip(UUID, UUID, UUID, BIGINT, TEXT, INTEGER, TEXT, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.spend_wallet_on_tip(UUID, UUID, UUID, BIGINT, TEXT, INTEGER, TEXT, TEXT, TEXT, TIMESTAMPTZ) TO service_role;

-- ── 11. Verification ────────────────────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration 051 Verification:';
  RAISE NOTICE 'payment_orders:      %', (SELECT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='payment_orders'));
  RAISE NOTICE 'consumption_orders:  %', (SELECT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='consumption_orders'));
  RAISE NOTICE 'creator_ledger:      %', (SELECT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='creator_ledger'));
  RAISE NOTICE 'payout_batches:      %', (SELECT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='payout_batches'));
  RAISE NOTICE 'credit_payram_deposit: %', (SELECT EXISTS (SELECT 1 FROM pg_proc WHERE proname='credit_payram_deposit'));
  RAISE NOTICE 'spend_wallet:          %', (SELECT EXISTS (SELECT 1 FROM pg_proc WHERE proname='spend_wallet'));
  RAISE NOTICE '========================================';
END $$;
