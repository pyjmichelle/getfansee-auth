-- 快速修复 SQL（复制到 Supabase SQL Editor 执行）
-- 修复 profiles 表缺少的字段

-- 1. 添加 email 字段
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS email text;

-- 为已有记录填充 email
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND (p.email IS NULL OR p.email = '');

-- 设置为 NOT NULL（在填充后）
ALTER TABLE public.profiles 
ALTER COLUMN email SET NOT NULL;

-- 2. 添加 age_verified 字段
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS age_verified boolean NOT NULL DEFAULT false;

-- 3. 添加 display_name 字段（如果不存在）
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS display_name text;

-- 4. 添加 role 字段（如果不存在，且有 CHECK 约束）
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'role'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN role text NOT NULL DEFAULT 'fan';
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('fan', 'creator'));
  END IF;
END $$;

-- 5. 添加 created_at 字段（如果不存在）
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT timezone('utc', now());

-- 6. 添加 updated_at 字段（如果不存在）
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT timezone('utc', now());

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
  USING (auth.uid() = id);

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

-- 10. 验证结果
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'profiles'
ORDER BY ordinal_position;



