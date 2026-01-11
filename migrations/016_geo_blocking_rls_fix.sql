-- 016_geo_blocking_rls_fix.sql
-- 修复地理屏蔽的 RLS 策略：允许查询 creator 的 blocked_countries
-- Execute this in Supabase Dashboard SQL Editor

-- ============================================
-- 1. 允许所有人（包括匿名用户）查询 creator 的 profile（用于地理屏蔽和显示）
-- ============================================

-- 创建策略：允许查询 creator 的 profile（用于地理屏蔽检查和显示 creator 信息）
-- 注意：creator 的 profile 信息（display_name, avatar_url, blocked_countries）是公开的
-- 这个策略允许匿名用户和认证用户都能查询 creator 的 profile
DROP POLICY IF EXISTS "profiles_select_creators" ON public.profiles;
CREATE POLICY "profiles_select_creators"
  ON public.profiles
  FOR SELECT
  TO authenticated, anon  -- 允许认证用户和匿名用户
  USING (
    -- 允许查询自己的 profile（已有 profiles_select_own 策略覆盖，但这里也包含）
    auth.uid() = id
    OR
    -- 允许查询 creator 的 profile（用于地理屏蔽和显示）
    -- 只允许查询 role = 'creator' 的用户
    -- 注意：creators 表的结构在不同迁移中可能不同，所以直接检查 role 字段
    role = 'creator'
  );

-- 注意：这个策略会与现有的 profiles_select_own 策略一起工作
-- Supabase 会使用 OR 逻辑，所以用户可以查询自己的 profile，也可以查询 creator 的 blocked_countries

-- ============================================
-- 2. 验证策略
-- ============================================

SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'profiles'
ORDER BY policyname;

