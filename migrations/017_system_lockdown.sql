-- 017_system_lockdown.sql
-- 系统逻辑锁死与视觉重塑：数据库字段扩充
-- Execute this in Supabase Dashboard SQL Editor

-- ============================================
-- 1. 添加 referrer_id 字段到 profiles 表（财务系统预留）
-- ============================================

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS referrer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 添加索引以优化查询
CREATE INDEX IF NOT EXISTS idx_profiles_referrer_id ON public.profiles(referrer_id);

-- ============================================
-- 2. 添加 cancelled_at 字段到 subscriptions 表
-- ============================================

-- 检查 subscriptions 表使用哪个 schema（subscriber_id 或 user_id）
DO $$
BEGIN
  -- 如果使用 subscriber_id（新 schema）
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'subscriptions' 
      AND column_name = 'subscriber_id'
  ) THEN
    ALTER TABLE public.subscriptions
    ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
  -- 如果使用 user_id（旧 schema）
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'subscriptions' 
      AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.subscriptions
    ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
  END IF;
END $$;

-- ============================================
-- 3. 验证字段
-- ============================================

SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name = 'referrer_id';

SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'subscriptions'
  AND column_name = 'cancelled_at';

