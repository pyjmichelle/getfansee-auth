-- 005_verify_paywall.sql
-- 验证 paywall 相关表结构是否完整
-- 在 Supabase Dashboard SQL Editor 中执行

-- 1. 检查 subscriptions 表是否存在
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'subscriptions'
    ) THEN '✅ subscriptions 表存在'
    ELSE '❌ subscriptions 表不存在'
  END AS subscriptions_status;

-- 2. 检查 post_unlocks 表是否存在
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'post_unlocks'
    ) THEN '✅ post_unlocks 表存在'
    ELSE '❌ post_unlocks 表不存在'
  END AS post_unlocks_status;

-- 3. 检查 subscriptions 表字段
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'subscriptions'
ORDER BY ordinal_position;

-- 4. 检查 post_unlocks 表字段
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'post_unlocks'
ORDER BY ordinal_position;

-- 5. 检查 RLS 是否启用
SELECT 
  tablename,
  CASE 
    WHEN rowsecurity THEN '✅ RLS 已启用'
    ELSE '❌ RLS 未启用'
  END AS rls_status
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename IN ('subscriptions', 'post_unlocks');

-- 6. 检查所有策略
SELECT 
  tablename,
  policyname,
  cmd,
  CASE 
    WHEN qual IS NOT NULL THEN '✅'
    ELSE '⚠️'
  END AS has_qual,
  CASE 
    WHEN with_check IS NOT NULL THEN '✅'
    ELSE '⚠️'
  END AS has_with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename IN ('subscriptions', 'post_unlocks')
ORDER BY tablename, policyname;

-- 7. 检查触发器
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND event_object_table IN ('subscriptions', 'post_unlocks');

