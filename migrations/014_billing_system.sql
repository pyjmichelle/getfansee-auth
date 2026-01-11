-- 014_billing_system.sql
-- 账务系统：钱包和交易流水
-- Execute this in Supabase Dashboard SQL Editor

-- ============================================
-- 1. Create user_wallets table
-- ============================================

CREATE TABLE IF NOT EXISTS public.user_wallets (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance_cents integer NOT NULL DEFAULT 0 CHECK (balance_cents >= 0),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

-- ============================================
-- 2. Create wallet_transactions table
-- ============================================

CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_type text NOT NULL CHECK (transaction_type IN ('deposit', 'purchase', 'refund')),
  amount_cents integer NOT NULL,
  balance_before_cents integer NOT NULL,
  balance_after_cents integer NOT NULL,
  reference_type text, -- 'post_id', 'subscription_id', etc.
  reference_id uuid, -- 关联的 post_id 或其他 ID
  description text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

-- 创建索引以优化查询
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_id ON public.wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created_at ON public.wallet_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_reference ON public.wallet_transactions(reference_type, reference_id);

-- ============================================
-- 3. Enable RLS
-- ============================================

ALTER TABLE public.user_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 4. user_wallets RLS policies
-- ============================================

-- SELECT: Users can view their own wallet
DROP POLICY IF EXISTS wallets_select_own ON public.user_wallets;
CREATE POLICY wallets_select_own
  ON public.user_wallets
  FOR SELECT
  USING (auth.uid() = id);

-- INSERT: Users can create their own wallet (auto-created on first use)
DROP POLICY IF EXISTS wallets_insert_own ON public.user_wallets;
CREATE POLICY wallets_insert_own
  ON public.user_wallets
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- UPDATE: Users can update their own wallet (only through functions)
DROP POLICY IF EXISTS wallets_update_own ON public.user_wallets;
CREATE POLICY wallets_update_own
  ON public.user_wallets
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ============================================
-- 5. wallet_transactions RLS policies
-- ============================================

-- SELECT: Users can view their own transactions
DROP POLICY IF EXISTS transactions_select_own ON public.wallet_transactions;
CREATE POLICY transactions_select_own
  ON public.wallet_transactions
  FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT: Only through functions (no direct insert policy)
-- Transactions are created by database functions only

-- ============================================
-- 6. Create updated_at trigger for user_wallets
-- ============================================

DROP TRIGGER IF EXISTS set_wallets_updated_at ON public.user_wallets;
CREATE TRIGGER set_wallets_updated_at
BEFORE UPDATE ON public.user_wallets
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- 7. Atomic purchase function: rpc_purchase_post
-- ============================================

CREATE OR REPLACE FUNCTION public.rpc_purchase_post(
  p_post_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post_price_cents integer;
  v_post_creator_id uuid;
  v_current_balance integer;
  v_new_balance integer;
  v_transaction_id uuid;
  v_purchase_id uuid;
  v_result jsonb;
BEGIN
  -- 1. 验证用户身份
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User not authenticated'
    );
  END IF;

  -- 2. 查询 post 信息（价格和创作者）
  SELECT price_cents, creator_id INTO v_post_price_cents, v_post_creator_id
  FROM public.posts
  WHERE id = p_post_id;

  IF v_post_price_cents IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Post not found'
    );
  END IF;

  -- 3. 验证是 PPV 内容（price_cents > 0）
  IF v_post_price_cents <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Post is not a PPV post'
    );
  END IF;

  -- 4. 检查是否已购买
  SELECT id INTO v_purchase_id
  FROM public.purchases
  WHERE fan_id = p_user_id AND post_id = p_post_id;

  IF v_purchase_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Post already purchased'
    );
  END IF;

  -- 5. 确保钱包存在（如果不存在则创建）
  INSERT INTO public.user_wallets (id, balance_cents)
  VALUES (p_user_id, 0)
  ON CONFLICT (id) DO NOTHING;

  -- 6. 获取当前余额（使用 SELECT FOR UPDATE 锁定行）
  SELECT balance_cents INTO v_current_balance
  FROM public.user_wallets
  WHERE id = p_user_id
  FOR UPDATE;

  -- 7. 检查余额是否充足（必须在数据库内部判断，防止余额变负数）
  IF v_current_balance < v_post_price_cents THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient balance',
      'balance_cents', v_current_balance,
      'required_cents', v_post_price_cents
    );
  END IF;

  -- 8. 计算新余额
  v_new_balance := v_current_balance - v_post_price_cents;

  -- 9. 原子操作：扣费 + 记录交易 + 创建购买记录
  BEGIN
    -- 9.1 扣费（更新余额）
    UPDATE public.user_wallets
    SET balance_cents = v_new_balance,
        updated_at = timezone('utc', now())
    WHERE id = p_user_id;

    -- 9.2 记录交易流水
    v_transaction_id := gen_random_uuid();
    INSERT INTO public.wallet_transactions (
      id,
      user_id,
      transaction_type,
      amount_cents,
      balance_before_cents,
      balance_after_cents,
      reference_type,
      reference_id,
      description
    ) VALUES (
      v_transaction_id,
      p_user_id,
      'purchase',
      -v_post_price_cents, -- 负数表示扣费
      v_current_balance,
      v_new_balance,
      'post_id',
      p_post_id,
      format('Purchase PPV post: %s', p_post_id)
    );

    -- 9.3 创建购买记录
    v_purchase_id := gen_random_uuid();
    INSERT INTO public.purchases (
      id,
      fan_id,
      post_id,
      paid_amount_cents
    ) VALUES (
      v_purchase_id,
      p_user_id,
      p_post_id,
      v_post_price_cents
    );

    -- 9.4 返回成功结果
    RETURN jsonb_build_object(
      'success', true,
      'transaction_id', v_transaction_id,
      'purchase_id', v_purchase_id,
      'balance_before_cents', v_current_balance,
      'balance_after_cents', v_new_balance,
      'amount_cents', v_post_price_cents
    );

  EXCEPTION
    WHEN OTHERS THEN
      -- 回滚（PostgreSQL 会自动回滚事务）
      RETURN jsonb_build_object(
        'success', false,
        'error', format('Transaction failed: %s', SQLERRM)
      );
  END;
END;
$$;

-- 授予执行权限
-- 注意：PostgreSQL 中，即使函数有默认参数，GRANT 也需要明确指定参数类型
-- 这里授予两个签名：两个参数和单个参数（使用默认值）
GRANT EXECUTE ON FUNCTION public.rpc_purchase_post(uuid, uuid) TO authenticated;
-- 对于有默认参数的函数，PostgreSQL 会自动处理单参数调用
-- 但为了确保兼容性，我们明确授予两个签名

-- ============================================
-- 8. Helper function: Get wallet balance
-- ============================================

CREATE OR REPLACE FUNCTION public.rpc_get_wallet_balance(
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance integer;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User not authenticated'
    );
  END IF;

  -- 确保钱包存在
  INSERT INTO public.user_wallets (id, balance_cents)
  VALUES (p_user_id, 0)
  ON CONFLICT (id) DO NOTHING;

  -- 获取余额
  SELECT balance_cents INTO v_balance
  FROM public.user_wallets
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'balance_cents', COALESCE(v_balance, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_get_wallet_balance(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_get_wallet_balance() TO authenticated;

-- ============================================
-- 9. Verify schema
-- ============================================

SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'user_wallets'
    ) THEN '✅ user_wallets 表存在'
    ELSE '❌ user_wallets 表不存在'
  END AS wallets_status;

SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'wallet_transactions'
    ) THEN '✅ wallet_transactions 表存在'
    ELSE '❌ wallet_transactions 表不存在'
  END AS transactions_status;

-- 验证函数是否存在（检查 pg_proc，不调用函数）
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public' 
        AND p.proname = 'rpc_purchase_post'
    ) THEN '✅ rpc_purchase_post 函数存在'
    ELSE '❌ rpc_purchase_post 函数不存在'
  END AS purchase_function_status;

-- 显示函数的完整签名信息
SELECT 
  p.proname AS function_name,
  pg_get_function_arguments(p.oid) AS arguments,
  pg_get_function_result(p.oid) AS return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname = 'rpc_purchase_post';

