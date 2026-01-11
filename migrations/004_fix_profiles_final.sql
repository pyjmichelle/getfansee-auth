-- 004_fix_profiles_final.sql
-- 最终修复：补齐 profiles 表所有字段并刷新 schema cache
-- 注意：在 Supabase Dashboard 的 SQL Editor 中执行本文件内容

-- 1. 添加 email 字段（如果不存在）
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'email'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN email text NOT NULL DEFAULT '';
    
    -- 为已有记录填充 email（从 auth.users 获取）
    UPDATE public.profiles p
    SET email = u.email
    FROM auth.users u
    WHERE p.id = u.id AND (p.email IS NULL OR p.email = '');
    
    ALTER TABLE public.profiles ALTER COLUMN email DROP DEFAULT;
  END IF;
END $$;

-- 2. 添加 display_name 字段（如果不存在）
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS display_name text;

-- 3. 添加 role 字段（如果不存在）
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN role text NOT NULL DEFAULT 'fan';
    -- 添加 CHECK 约束（如果不存在）
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conname = 'profiles_role_check'
    ) THEN
      ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('fan', 'creator'));
    END IF;
  END IF;
END $$;

-- 4. 添加 age_verified 字段（如果不存在）
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS age_verified boolean NOT NULL DEFAULT false;

-- 5. 添加 created_at 字段（如果不存在）
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN created_at timestamptz NOT NULL DEFAULT timezone('utc', now());
  END IF;
END $$;

-- 6. 添加 updated_at 字段（如果不存在）
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN updated_at timestamptz NOT NULL DEFAULT timezone('utc', now());
  END IF;
END $$;

-- 7. 确保 RLS 已启用
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 8. 重新创建 RLS 策略
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 9. 创建 updated_at 触发器
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- 10. 刷新 schema cache（通过 NOTIFY）
NOTIFY pgrst, 'reload schema';

-- 11. 验证最终结构
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'profiles'
ORDER BY ordinal_position;

-- 12. 验证 RLS 策略
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'profiles'
ORDER BY policyname;



