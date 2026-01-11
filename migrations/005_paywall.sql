-- 005_paywall.sql
-- Paywall 相关表结构：subscriptions 和 post_unlocks
-- 注意：在 Supabase Dashboard 的 SQL Editor 中执行本文件内容

-- ============================================
-- 1. subscriptions 表
-- ============================================

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  creator_id uuid NULL, -- MVP 可先留空
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'expired')),
  current_period_end timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE(user_id) -- 每个用户只能有一条 active subscription
);

-- ============================================
-- 2. post_unlocks 表
-- ============================================

CREATE TABLE IF NOT EXISTS public.post_unlocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE(user_id, post_id) -- 每个用户对每个 post 只能解锁一次
);

-- ============================================
-- 3. 创建通用 updated_at 触发器函数（如果不存在）
-- ============================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 4. subscriptions 表的 updated_at 触发器
-- ============================================

DROP TRIGGER IF EXISTS set_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER set_subscriptions_updated_at
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- 5. 启用 RLS
-- ============================================

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_unlocks ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 6. subscriptions RLS 策略
-- ============================================

-- SELECT: 用户只能查询自己的 subscription
DROP POLICY IF EXISTS "subscriptions_select_own" ON public.subscriptions;
CREATE POLICY "subscriptions_select_own"
  ON public.subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT: 用户只能插入自己的 subscription
DROP POLICY IF EXISTS "subscriptions_insert_own" ON public.subscriptions;
CREATE POLICY "subscriptions_insert_own"
  ON public.subscriptions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: 用户只能更新自己的 subscription
DROP POLICY IF EXISTS "subscriptions_update_own" ON public.subscriptions;
CREATE POLICY "subscriptions_update_own"
  ON public.subscriptions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: 用户只能删除自己的 subscription
DROP POLICY IF EXISTS "subscriptions_delete_own" ON public.subscriptions;
CREATE POLICY "subscriptions_delete_own"
  ON public.subscriptions
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- 7. post_unlocks RLS 策略
-- ============================================

-- SELECT: 用户只能查询自己的 unlocks
DROP POLICY IF EXISTS "post_unlocks_select_own" ON public.post_unlocks;
CREATE POLICY "post_unlocks_select_own"
  ON public.post_unlocks
  FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT: 用户只能插入自己的 unlock
DROP POLICY IF EXISTS "post_unlocks_insert_own" ON public.post_unlocks;
CREATE POLICY "post_unlocks_insert_own"
  ON public.post_unlocks
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- DELETE: 用户只能删除自己的 unlock
DROP POLICY IF EXISTS "post_unlocks_delete_own" ON public.post_unlocks;
CREATE POLICY "post_unlocks_delete_own"
  ON public.post_unlocks
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- 8. 验证表结构
-- ============================================

DO $$
DECLARE
  subscriptions_exists boolean;
  post_unlocks_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'subscriptions'
  ) INTO subscriptions_exists;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'post_unlocks'
  ) INTO post_unlocks_exists;
  
  IF subscriptions_exists AND post_unlocks_exists THEN
    RAISE NOTICE '✅ subscriptions 和 post_unlocks 表创建成功！';
  ELSE
    RAISE WARNING '⚠️  表创建可能失败，请检查错误信息';
  END IF;
END $$;

-- ============================================
-- 9. 显示所有策略
-- ============================================

SELECT 
  tablename,
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename IN ('subscriptions', 'post_unlocks')
ORDER BY tablename, policyname;



