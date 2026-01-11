-- 018_feature_completion.sql
-- Feature Completion: Content Management, Wallet, KYC, Reports
-- Execute this in Supabase Dashboard SQL Editor

-- ============================================
-- 1. Add deleted_at to posts (soft delete)
-- ============================================

ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;

-- Add index for filtering non-deleted posts
CREATE INDEX IF NOT EXISTS idx_posts_not_deleted 
ON public.posts(created_at DESC) 
WHERE deleted_at IS NULL;

-- ============================================
-- 2. Add removed_by_admin to posts (admin deletion marker)
-- ============================================

ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS removed_by_admin boolean NOT NULL DEFAULT false;

-- ============================================
-- 3. Add is_banned to profiles (user ban status)
-- ============================================

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_banned boolean NOT NULL DEFAULT false;

-- Add ban_until for temporary bans (optional)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS ban_until timestamptz NULL;

-- ============================================
-- 4. Create wallet_accounts table
-- ============================================

CREATE TABLE IF NOT EXISTS public.wallet_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  available_balance_cents bigint NOT NULL DEFAULT 0,
  pending_balance_cents bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE(user_id)
);

ALTER TABLE public.wallet_accounts ENABLE ROW LEVEL SECURITY;

-- RLS: Users can only see their own wallet
DROP POLICY IF EXISTS "wallet_accounts_select_own" ON public.wallet_accounts;
CREATE POLICY "wallet_accounts_select_own"
  ON public.wallet_accounts
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "wallet_accounts_update_own" ON public.wallet_accounts;
CREATE POLICY "wallet_accounts_update_own"
  ON public.wallet_accounts
  FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================
-- 5. Create transactions table
-- ============================================

CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'subscription', 'ppv_purchase', 'commission', 'payout')),
  amount_cents bigint NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  available_on timestamptz NULL, -- 结算期：预计可提取时间
  metadata jsonb, -- 额外信息（如 post_id, creator_id, subscription_id 等）
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Index for user transactions
CREATE INDEX IF NOT EXISTS idx_transactions_user_type 
ON public.transactions(user_id, type, created_at DESC);

-- RLS: Users can only see their own transactions
DROP POLICY IF EXISTS "transactions_select_own" ON public.transactions;
CREATE POLICY "transactions_select_own"
  ON public.transactions
  FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================
-- 6. Create creator_verifications table (KYC)
-- ============================================

CREATE TABLE IF NOT EXISTS public.creator_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  real_name text NOT NULL,
  birth_date date NOT NULL,
  country text NOT NULL,
  id_doc_urls text[] NOT NULL, -- 证件照片 URL 数组
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz NULL,
  rejection_reason text NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE(user_id)
);

ALTER TABLE public.creator_verifications ENABLE ROW LEVEL SECURITY;

-- RLS: Users can only see their own verification
DROP POLICY IF EXISTS "creator_verifications_select_own" ON public.creator_verifications;
CREATE POLICY "creator_verifications_select_own"
  ON public.creator_verifications
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "creator_verifications_insert_own" ON public.creator_verifications;
CREATE POLICY "creator_verifications_insert_own"
  ON public.creator_verifications
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 7. Create reports table
-- ============================================

CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_type text NOT NULL CHECK (reported_type IN ('post', 'user', 'comment')),
  reported_id uuid NOT NULL, -- 被举报的内容/用户 ID
  reason text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
  resolved_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamptz NULL,
  resolution_action text NULL, -- 'delete', 'ban', 'no_violation'
  resolution_notes text NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Index for reports
CREATE INDEX IF NOT EXISTS idx_reports_type_id 
ON public.reports(reported_type, reported_id);

CREATE INDEX IF NOT EXISTS idx_reports_status 
ON public.reports(status, created_at DESC);

-- RLS: Users can see their own reports
DROP POLICY IF EXISTS "reports_select_own" ON public.reports;
CREATE POLICY "reports_select_own"
  ON public.reports
  FOR SELECT
  USING (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "reports_insert_own" ON public.reports;
CREATE POLICY "reports_insert_own"
  ON public.reports
  FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

-- ============================================
-- 8. Add updated_at triggers
-- ============================================

-- wallet_accounts
DROP TRIGGER IF EXISTS set_wallet_accounts_updated_at ON public.wallet_accounts;
CREATE TRIGGER set_wallet_accounts_updated_at
BEFORE UPDATE ON public.wallet_accounts
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- transactions
DROP TRIGGER IF EXISTS set_transactions_updated_at ON public.transactions;
CREATE TRIGGER set_transactions_updated_at
BEFORE UPDATE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- creator_verifications
DROP TRIGGER IF EXISTS set_creator_verifications_updated_at ON public.creator_verifications;
CREATE TRIGGER set_creator_verifications_updated_at
BEFORE UPDATE ON public.creator_verifications
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- reports
DROP TRIGGER IF EXISTS set_reports_updated_at ON public.reports;
CREATE TRIGGER set_reports_updated_at
BEFORE UPDATE ON public.reports
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();


