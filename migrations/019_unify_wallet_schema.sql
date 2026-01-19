-- 019_unify_wallet_schema.sql
-- 统一钱包表结构：修复 rpc_purchase_post 使用 wallet_accounts 表
-- Execute this in Supabase Dashboard SQL Editor

-- ============================================
-- 问题说明：
-- migration 014 创建了 user_wallets 和 wallet_transactions
-- migration 018 创建了 wallet_accounts 和 transactions
-- 前端代码使用 wallet_accounts，但 RPC 函数使用 user_wallets
-- 这导致充值和扣款使用不同的表，余额永远不正确
-- ============================================

-- ============================================
-- 1. 重新创建 rpc_purchase_post 函数使用 wallet_accounts 表
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
  v_current_balance bigint;
  v_new_balance bigint;
  v_transaction_id uuid;
  v_purchase_id uuid;
  v_wallet_id uuid;
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

  -- 5. 确保钱包存在（使用 wallet_accounts 表）
  INSERT INTO public.wallet_accounts (user_id, available_balance_cents, pending_balance_cents)
  VALUES (p_user_id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- 6. 获取当前余额（使用 SELECT FOR UPDATE 锁定行）
  SELECT id, available_balance_cents INTO v_wallet_id, v_current_balance
  FROM public.wallet_accounts
  WHERE user_id = p_user_id
  FOR UPDATE;

  -- 7. 检查余额是否充足
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
    -- 9.1 扣费（更新 wallet_accounts 表）
    UPDATE public.wallet_accounts
    SET available_balance_cents = v_new_balance,
        updated_at = timezone('utc', now())
    WHERE user_id = p_user_id;

    -- 9.2 记录交易流水（使用 transactions 表）
    v_transaction_id := gen_random_uuid();
    INSERT INTO public.transactions (
      id,
      user_id,
      type,
      amount_cents,
      status,
      metadata
    ) VALUES (
      v_transaction_id,
      p_user_id,
      'ppv_purchase',
      -v_post_price_cents,
      'completed',
      jsonb_build_object(
        'post_id', p_post_id,
        'creator_id', v_post_creator_id,
        'balance_before_cents', v_current_balance,
        'balance_after_cents', v_new_balance
      )
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
      RETURN jsonb_build_object(
        'success', false,
        'error', format('Transaction failed: %s', SQLERRM)
      );
  END;
END;
$$;

-- 授予执行权限
GRANT EXECUTE ON FUNCTION public.rpc_purchase_post(uuid, uuid) TO authenticated;

-- ============================================
-- 2. 重新创建 rpc_get_wallet_balance 函数使用 wallet_accounts 表
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
  v_balance bigint;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User not authenticated'
    );
  END IF;

  -- 确保钱包存在（使用 wallet_accounts 表）
  INSERT INTO public.wallet_accounts (user_id, available_balance_cents, pending_balance_cents)
  VALUES (p_user_id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- 获取余额
  SELECT available_balance_cents INTO v_balance
  FROM public.wallet_accounts
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'balance_cents', COALESCE(v_balance, 0)
  );
END;
$$;

-- 授予执行权限
GRANT EXECUTE ON FUNCTION public.rpc_get_wallet_balance(uuid) TO authenticated;

-- ============================================
-- 3. 添加 purchases 表的 paid_amount_cents 列（如果不存在）
-- ============================================

ALTER TABLE public.purchases 
ADD COLUMN IF NOT EXISTS paid_amount_cents bigint NOT NULL DEFAULT 0;

-- ============================================
-- 4. 验证
-- ============================================

SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'wallet_accounts'
    ) THEN '✅ wallet_accounts 表存在'
    ELSE '❌ wallet_accounts 表不存在'
  END AS wallet_accounts_status;

SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'transactions'
    ) THEN '✅ transactions 表存在'
    ELSE '❌ transactions 表不存在'
  END AS transactions_status;

SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public' 
        AND p.proname = 'rpc_purchase_post'
    ) THEN '✅ rpc_purchase_post 函数已更新'
    ELSE '❌ rpc_purchase_post 函数不存在'
  END AS purchase_function_status;

-- 显示函数签名
SELECT 
  p.proname AS function_name,
  pg_get_function_arguments(p.oid) AS arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname IN ('rpc_purchase_post', 'rpc_get_wallet_balance');
