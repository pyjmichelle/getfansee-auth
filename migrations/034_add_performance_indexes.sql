-- Migration 034: Add missing performance indexes
-- Fixes CRITICAL-03, CRITICAL-04, HIGH-02 from DATABASE_INTEGRITY_REPORT
-- Safe to run multiple times (all use IF NOT EXISTS)

-- ── transactions ────────────────────────────────────────────────────────────

-- Creator earnings query optimization (type + status)
CREATE INDEX IF NOT EXISTS idx_transactions_creator_earnings
  ON public.transactions(user_id, type, status, created_at DESC)
  WHERE type IN ('ppv_revenue', 'subscription', 'commission');

-- Settlement query optimization (pending → available)
CREATE INDEX IF NOT EXISTS idx_transactions_settlement
  ON public.transactions(status, available_on, type)
  WHERE status = 'pending' AND available_on IS NOT NULL;

-- Idempotency key lookup optimization
CREATE INDEX IF NOT EXISTS idx_transactions_idempotency_key
  ON public.transactions(user_id, type, status, ((metadata->>'idempotency_key')))
  WHERE metadata ? 'idempotency_key';

-- Financial audit query
CREATE INDEX IF NOT EXISTS idx_transactions_audit
  ON public.transactions(type, status, created_at DESC);

-- Time-based sort optimization
CREATE INDEX IF NOT EXISTS idx_transactions_created_at
  ON public.transactions(created_at DESC);

-- ── purchases ────────────────────────────────────────────────────────────────

-- User purchase history (app/api/purchases/route.ts)
CREATE INDEX IF NOT EXISTS idx_purchases_fan_created
  ON public.purchases(fan_id, created_at DESC);

-- Post purchase stats
CREATE INDEX IF NOT EXISTS idx_purchases_post_created
  ON public.purchases(post_id, created_at DESC);

-- Idempotency key on purchases
CREATE INDEX IF NOT EXISTS idx_purchases_idempotency_key
  ON public.purchases(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Time-based sort
CREATE INDEX IF NOT EXISTS idx_purchases_created_at
  ON public.purchases(created_at DESC);

-- ── subscriptions ────────────────────────────────────────────────────────────

-- Active subscription expiry cleanup
CREATE INDEX IF NOT EXISTS idx_subscriptions_expiry
  ON public.subscriptions(status, ends_at)
  WHERE status = 'active';

-- Creator subscriber list
CREATE INDEX IF NOT EXISTS idx_subscriptions_creator_active
  ON public.subscriptions(creator_id, status, ends_at DESC)
  WHERE status = 'active';

-- Fan active subscription lookup (isActiveSubscriber)
CREATE INDEX IF NOT EXISTS idx_subscriptions_fan_active
  ON public.subscriptions(subscriber_id, status, ends_at)
  WHERE status = 'active';

-- ── wallet_accounts ──────────────────────────────────────────────────────────

-- Covering index for balance reads
CREATE INDEX IF NOT EXISTS idx_wallet_accounts_user_balance
  ON public.wallet_accounts(user_id, available_balance_cents, pending_balance_cents);

-- Active accounts only (have balance)
CREATE INDEX IF NOT EXISTS idx_wallet_accounts_active
  ON public.wallet_accounts(user_id)
  WHERE available_balance_cents > 0 OR pending_balance_cents > 0;

-- Updated-at for auditing
CREATE INDEX IF NOT EXISTS idx_wallet_accounts_updated_at
  ON public.wallet_accounts(updated_at DESC);
