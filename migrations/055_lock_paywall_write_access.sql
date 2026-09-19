-- Migration 055: take paywall write access away from fans
--
-- The paywall's access tables were created (005_paywall.sql, and the later
-- purchases table) with per-user *write* policies that let an authenticated fan
-- INSERT/UPDATE/DELETE their own rows directly with the browser anon key. On
-- the three tables that actually gate paid content that is a free-content
-- bypass, not a convenience:
--
--   subscriptions  isActiveSubscriber() / canViewPost() read this table, and a
--                  fan could `insert` a row (status='active',
--                  current_period_end = now()+10y) or `update` an expired one
--                  to unlock every subscriber-only post without paying — and
--                  `delete` it to erase the evidence.
--
--   purchases      hasPurchasedPost() / canViewPost() read this table for PPV.
--                  `purchases_insert_own` let a fan insert a row for any post
--                  id and unlock PPV content for $0. This is the same hole as
--                  subscriptions, on the table PPV access actually consults.
--
--   post_unlocks   legacy PPV grant table (superseded by `purchases`); its
--                  self-insert policy is the same class of hole. Closed here so
--                  it cannot be quietly re-consulted later as a back door.
--
-- Every legitimate write to these tables already runs with BYPASSRLS:
--   - the paid flows go through spend_wallet_on_ppv / spend_wallet_on_subscription,
--     SECURITY DEFINER functions owned by `postgres`;
--   - the remaining app writes (subscribe30d / cancelSubscription for $0 subs)
--     move to the service-role admin client in the same change set.
-- So dropping the fan-facing write policies denies the browser path without
-- touching any real one. The SELECT policies stay: a fan must still read their
-- own subscription/purchase, and a creator must still read their subscribers
-- (subscriptions_select_self_or_creator).
--
-- Idempotent: each DROP is `IF EXISTS`, so re-running is a no-op, and a fresh
-- database that never had these policies is unaffected.

-- ── subscriptions ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "subscriptions_insert_own" ON public.subscriptions;
DROP POLICY IF EXISTS "subscriptions_update_own" ON public.subscriptions;
DROP POLICY IF EXISTS "subscriptions_delete_own" ON public.subscriptions;

-- ── purchases ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "purchases_insert_own" ON public.purchases;
-- Historical names seen across 024/030/032; drop defensively so no write path
-- survives under an older policy name.
DROP POLICY IF EXISTS "purchases_update_own" ON public.purchases;
DROP POLICY IF EXISTS "purchases_delete_own" ON public.purchases;

-- ── post_unlocks (legacy) ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "post_unlocks_insert_own" ON public.post_unlocks;
DROP POLICY IF EXISTS "post_unlocks_delete_own" ON public.post_unlocks;

-- ── Verification ─────────────────────────────────────────────────────────────
-- Expect: zero INSERT/UPDATE/DELETE policies left on these tables; SELECT policies remain.
DO $$
DECLARE
  write_policies int;
  select_policies int;
BEGIN
  SELECT count(*) INTO write_policies
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('subscriptions', 'purchases', 'post_unlocks')
    AND cmd IN ('INSERT', 'UPDATE', 'DELETE');

  SELECT count(*) INTO select_policies
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('subscriptions', 'purchases', 'post_unlocks')
    AND cmd = 'SELECT';

  RAISE NOTICE 'paywall write policies remaining (want 0): %', write_policies;
  RAISE NOTICE 'paywall select policies remaining (want >=1 per read table): %', select_policies;

  IF write_policies <> 0 THEN
    RAISE EXCEPTION 'migration 055 left % fan-facing write policies on paywall tables', write_policies;
  END IF;
END $$;
