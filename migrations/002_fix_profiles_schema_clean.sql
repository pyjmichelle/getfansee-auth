-- 002_fix_profiles_schema_clean.sql
-- 修复已有数据库：为 profiles 表添加缺失的字段（清理版本，无重复）
-- 注意：在 Supabase Dashboard 的 SQL Editor 中执行本文件内容

-- 添加 email 字段（如果不存在）
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'email'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN email text NOT NULL DEFAULT '';
    
    -- 为已有记录填充 email（从 auth.users 获取）
    UPDATE public.profiles p
    SET email = u.email
    FROM auth.users u
    WHERE p.id = u.id AND (p.email IS NULL OR p.email = '');
    
    -- 移除默认值，因为现在所有记录都有 email
    ALTER TABLE public.profiles ALTER COLUMN email DROP DEFAULT;
  END IF;
END $$;

-- 添加 age_verified 字段（如果不存在）
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'age_verified'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN age_verified boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- 添加 display_name 字段（如果不存在）
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'display_name'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN display_name text;
  END IF;
END $$;

-- 添加 role 字段（如果不存在）
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'role'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN role text NOT NULL DEFAULT 'fan';
  END IF;
END $$;

-- 添加 created_at 字段（如果不存在）
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN created_at timestamptz NOT NULL DEFAULT timezone('utc', now());
  END IF;
END $$;

-- 添加 updated_at 字段（如果不存在）
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN updated_at timestamptz NOT NULL DEFAULT timezone('utc', now());
  END IF;
END $$;

-- 确保 RLS 已启用
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 重新创建 RLS 策略（如果不存在）
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- 创建 updated_at 自动更新触发器（如果不存在）
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

-- 验证修复结果
DO $$
DECLARE
  missing_columns text[];
  all_columns text[];
BEGIN
  -- 检查所有必需字段
  SELECT array_agg(column_name)
  INTO missing_columns
  FROM (
    SELECT 'id' AS column_name WHERE NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'id'
    )
    UNION ALL
    SELECT 'email' WHERE NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'email'
    )
    UNION ALL
    SELECT 'display_name' WHERE NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'display_name'
    )
    UNION ALL
    SELECT 'role' WHERE NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role'
    )
    UNION ALL
    SELECT 'age_verified' WHERE NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'age_verified'
    )
    UNION ALL
    SELECT 'created_at' WHERE NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'created_at'
    )
    UNION ALL
    SELECT 'updated_at' WHERE NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'updated_at'
    )
  ) AS missing;
  
  -- 获取所有现有字段
  SELECT array_agg(column_name ORDER BY ordinal_position)
  INTO all_columns
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'profiles';
  
  IF array_length(missing_columns, 1) > 0 THEN
    RAISE NOTICE '⚠️  警告：以下字段仍然缺失: %', array_to_string(missing_columns, ', ');
  ELSE
    RAISE NOTICE '✅ profiles 表结构修复完成！所有必需字段已存在。';
    RAISE NOTICE '📋 当前字段列表: %', array_to_string(all_columns, ', ');
  END IF;
END $$;

