-- 003_fix_rls_policies.sql
-- 修复 profiles 表的 RLS 策略，确保可以正常插入和更新
-- 注意：在 Supabase Dashboard 的 SQL Editor 中执行本文件内容

-- 确保 RLS 已启用
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 删除所有现有策略（重新创建）
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_own" ON public.profiles;

-- 重新创建策略

-- SELECT 策略：用户可以查询自己的 profile
CREATE POLICY "profiles_select_own"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- INSERT 策略：用户可以插入自己的 profile
-- 关键：WITH CHECK 确保插入的 id 等于当前用户的 id
CREATE POLICY "profiles_insert_own"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- UPDATE 策略：用户可以更新自己的 profile
CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- DELETE 策略：用户可以删除自己的 profile（可选，如果需要）
CREATE POLICY "profiles_delete_own"
  ON public.profiles
  FOR DELETE
  USING (auth.uid() = id);

-- 验证策略
DO $$
DECLARE
  policy_count integer;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'profiles';
  
  IF policy_count >= 3 THEN
    RAISE NOTICE '✅ RLS 策略修复完成！已创建 % 个策略。', policy_count;
  ELSE
    RAISE WARNING '⚠️  警告：只创建了 % 个策略，预期至少 3 个。', policy_count;
  END IF;
END $$;

-- 显示所有策略
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'profiles'
ORDER BY policyname;
