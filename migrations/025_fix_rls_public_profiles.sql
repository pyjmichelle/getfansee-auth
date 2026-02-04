-- 025_fix_rls_public_profiles.sql
-- P0 安全修复：允许用户查看公开的 Creator 信息
-- 这解决了代码大量使用 Service Role 绕过 RLS 的问题
-- Execute this in Supabase Dashboard SQL Editor

-- ============================================
-- 1. 修复 profiles 表 RLS 策略
-- ============================================

-- 删除旧的策略（包括可能已存在的新策略名称）
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_self_or_creator" ON public.profiles;

-- 创建新策略：允许查看自己的 profile 或公开的 creator profile
CREATE POLICY "profiles_select_self_or_creator"
  ON public.profiles
  FOR SELECT
  USING (
    -- 可以查看自己的 profile
    auth.uid() = id
    OR
    -- 可以查看未被封禁的 creator 的公开信息
    (role = 'creator' AND NOT COALESCE(is_banned, false))
  );

-- 保持其他策略不变（insert/update/delete 只能操作自己的）
-- 这些策略在 003_fix_rls_policies.sql 中已定义

-- ============================================
-- 2. 修复 post_comments 表 RLS 策略
-- ============================================

-- 确保 RLS 已启用
ALTER TABLE IF EXISTS public.post_comments ENABLE ROW LEVEL SECURITY;

-- 删除旧策略（包括可能已存在的新策略名称）
DROP POLICY IF EXISTS "post_comments_select" ON public.post_comments;
DROP POLICY IF EXISTS "post_comments_insert" ON public.post_comments;
DROP POLICY IF EXISTS "post_comments_delete" ON public.post_comments;
DROP POLICY IF EXISTS "post_comments_select_authenticated" ON public.post_comments;
DROP POLICY IF EXISTS "post_comments_insert_authenticated" ON public.post_comments;
DROP POLICY IF EXISTS "post_comments_delete_own" ON public.post_comments;

-- 允许任何已登录用户查看评论（评论是公开的）
CREATE POLICY "post_comments_select_authenticated"
  ON public.post_comments
  FOR SELECT
  TO authenticated
  USING (true);

-- 允许已登录用户创建评论
CREATE POLICY "post_comments_insert_authenticated"
  ON public.post_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 只允许删除自己的评论
CREATE POLICY "post_comments_delete_own"
  ON public.post_comments
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================
-- 3. 修复 subscriptions 表 RLS 策略
-- ============================================

-- 删除旧策略（包括可能已存在的新策略名称）
DROP POLICY IF EXISTS "subscriptions_select_own" ON public.subscriptions;
DROP POLICY IF EXISTS "subscriptions_select_self_or_creator" ON public.subscriptions;

-- 允许用户查看自己的订阅，以及 creator 查看自己的订阅者
-- 注意：subscriptions 表使用 subscriber_id（从 008_phase2_paywall.sql 开始）
CREATE POLICY "subscriptions_select_self_or_creator"
  ON public.subscriptions
  FOR SELECT
  TO authenticated
  USING (
    -- Fan 可以查看自己的订阅
    auth.uid() = subscriber_id
    OR
    -- Creator 可以查看自己的订阅者
    auth.uid() = creator_id
  );

-- ============================================
-- 4. 修复 purchases 表 RLS 策略
-- ============================================

-- 确保 RLS 已启用
ALTER TABLE IF EXISTS public.purchases ENABLE ROW LEVEL SECURITY;

-- 删除旧策略（包括可能已存在的新策略名称）
DROP POLICY IF EXISTS "purchases_select_own" ON public.purchases;
DROP POLICY IF EXISTS "purchases_select_self_or_creator" ON public.purchases;

-- 允许用户查看自己的购买，以及 creator 查看自己帖子的购买记录
CREATE POLICY "purchases_select_self_or_creator"
  ON public.purchases
  FOR SELECT
  TO authenticated
  USING (
    -- Fan 可以查看自己的购买（purchases 表使用 fan_id）
    auth.uid() = fan_id
    OR
    -- Creator 可以通过 posts 表查看自己帖子的购买
    EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = purchases.post_id
      AND p.creator_id = auth.uid()
    )
  );

-- ============================================
-- 5. 修复 transactions 表 RLS 策略
-- ============================================

-- 确保 RLS 已启用
ALTER TABLE IF EXISTS public.transactions ENABLE ROW LEVEL SECURITY;

-- 删除旧策略（先删除再创建，确保幂等性）
DROP POLICY IF EXISTS "transactions_select_own" ON public.transactions;

-- 只允许用户查看自己的交易记录
CREATE POLICY "transactions_select_own"
  ON public.transactions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================
-- 6. 创建 public_creator_profiles VIEW
-- ============================================
-- 这个 view 只暴露 creator 的公开信息，不包含敏感字段
-- 可以被 anon 和 authenticated 用户访问

DROP VIEW IF EXISTS public.public_creator_profiles;

CREATE VIEW public.public_creator_profiles AS
SELECT 
  id,
  display_name,
  avatar_url,
  bio,
  role,
  created_at
FROM public.profiles
WHERE role = 'creator' AND NOT COALESCE(is_banned, false);

-- 授予 anon 和 authenticated 用户 SELECT 权限
GRANT SELECT ON public.public_creator_profiles TO anon;
GRANT SELECT ON public.public_creator_profiles TO authenticated;

-- 添加注释
COMMENT ON VIEW public.public_creator_profiles IS '公开的 Creator 信息视图，只包含非敏感字段';

-- ============================================
-- 7. 创建索引优化查询
-- ============================================

-- 为 profiles 表添加索引，优化 creator 查询
CREATE INDEX IF NOT EXISTS idx_profiles_role_banned 
  ON public.profiles(role, is_banned) 
  WHERE role = 'creator';

-- ============================================
-- 8. 验证
-- ============================================

DO $$
DECLARE
  v_profile_policies integer;
  v_comment_policies integer;
  v_subscription_policies integer;
  v_purchase_policies integer;
  v_transaction_policies integer;
  v_view_exists boolean;
BEGIN
  SELECT COUNT(*) INTO v_profile_policies
  FROM pg_policies WHERE tablename = 'profiles' AND schemaname = 'public';
  
  SELECT COUNT(*) INTO v_comment_policies
  FROM pg_policies WHERE tablename = 'post_comments' AND schemaname = 'public';
  
  SELECT COUNT(*) INTO v_subscription_policies
  FROM pg_policies WHERE tablename = 'subscriptions' AND schemaname = 'public';
  
  SELECT COUNT(*) INTO v_purchase_policies
  FROM pg_policies WHERE tablename = 'purchases' AND schemaname = 'public';
  
  SELECT COUNT(*) INTO v_transaction_policies
  FROM pg_policies WHERE tablename = 'transactions' AND schemaname = 'public';
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.views 
    WHERE table_schema = 'public' AND table_name = 'public_creator_profiles'
  ) INTO v_view_exists;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration 025 Verification:';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'profiles policies: %', v_profile_policies;
  RAISE NOTICE 'post_comments policies: %', v_comment_policies;
  RAISE NOTICE 'subscriptions policies: %', v_subscription_policies;
  RAISE NOTICE 'purchases policies: %', v_purchase_policies;
  RAISE NOTICE 'transactions policies: %', v_transaction_policies;
  RAISE NOTICE 'public_creator_profiles view exists: %', v_view_exists;
  RAISE NOTICE '========================================';
END $$;
