-- 015_geo_blocking_kyc.sql
-- 地理屏蔽和 KYC 状态支持
-- Execute this in Supabase Dashboard SQL Editor

-- ============================================
-- 1. Add blocked_countries to profiles table
-- ============================================

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS blocked_countries text[] DEFAULT ARRAY[]::text[];

-- 添加注释
COMMENT ON COLUMN public.profiles.blocked_countries IS 'Array of ISO country codes (e.g., ["CN", "US"]) that the creator wants to block';

-- ============================================
-- 2. Verify schema
-- ============================================

SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'profiles'
  AND column_name = 'blocked_countries';

