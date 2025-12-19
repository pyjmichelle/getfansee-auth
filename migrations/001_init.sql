-- 001_init.sql
-- 基础 schema：profiles / creators / posts / subscriptions / post_unlocks / saved_posts
-- 注意：在 Supabase Dashboard 的 SQL Editor 中执行本文件内容

-- 扩展：uuid-ossp（如果尚未启用）
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-------------------------
-- profiles
-------------------------

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  display_name text,
  role text NOT NULL DEFAULT 'fan', -- 'fan' | 'creator'
  age_verified boolean NOT NULL DEFAULT false,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 仅本人可见/可改自己的 profile
CREATE POLICY IF NOT EXISTS "profiles_select_own"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY IF NOT EXISTS "profiles_insert_own"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY IF NOT EXISTS "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id);

-------------------------
-- creators
-------------------------

CREATE TABLE IF NOT EXISTS public.creators (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected'
  display_name text,
  bio text,
  avatar_url text,
  banner_url text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.creators ENABLE ROW LEVEL SECURITY;

-- 任何人都可以读取 creator 公共信息
CREATE POLICY IF NOT EXISTS "creators_select_public"
  ON public.creators
  FOR SELECT
  USING (true);

-- 仅本人可插入/更新自己的 creator 记录
CREATE POLICY IF NOT EXISTS "creators_insert_own"
  ON public.creators
  FOR INSERT
  WITH CHECK (auth.uid() = profile_id);

CREATE POLICY IF NOT EXISTS "creators_update_own"
  ON public.creators
  FOR UPDATE
  USING (auth.uid() = profile_id);

-------------------------
-- posts
-------------------------

CREATE TABLE IF NOT EXISTS public.posts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id uuid NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
  title text,
  content text,
  media_url text,
  access_type text NOT NULL DEFAULT 'subscribers', -- 'subscribers' | 'ppv'
  ppv_price_cents integer, -- 对于 PPV，单位：分
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- 所有人都可以看到帖子元数据，但内容字段需要在应用层做「锁定」处理
CREATE POLICY IF NOT EXISTS "posts_select_public"
  ON public.posts
  FOR SELECT
  USING (true);

-- 仅 creator 本人可创建/更新自己的帖子
CREATE POLICY IF NOT EXISTS "posts_insert_creator"
  ON public.posts
  FOR INSERT
  WITH CHECK (auth.uid() = (SELECT profile_id FROM public.creators c WHERE c.id = creator_id));

CREATE POLICY IF NOT EXISTS "posts_update_creator"
  ON public.posts
  FOR UPDATE
  USING (auth.uid() = (SELECT profile_id FROM public.creators c WHERE c.id = creator_id));

-------------------------
-- subscriptions
-------------------------

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  fan_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active', -- active | cancelled | expired
  current_period_end timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (fan_id, creator_id)
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- 粉丝只能看到自己的订阅
CREATE POLICY IF NOT EXISTS "subscriptions_select_own"
  ON public.subscriptions
  FOR SELECT
  USING (auth.uid() = fan_id);

CREATE POLICY IF NOT EXISTS "subscriptions_insert_own"
  ON public.subscriptions
  FOR INSERT
  WITH CHECK (auth.uid() = fan_id);

CREATE POLICY IF NOT EXISTS "subscriptions_update_own"
  ON public.subscriptions
  FOR UPDATE
  USING (auth.uid() = fan_id);

-------------------------
-- post_unlocks (PPV 解锁)
-------------------------

CREATE TABLE IF NOT EXISTS public.post_unlocks (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  fan_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (fan_id, post_id)
);

ALTER TABLE public.post_unlocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "post_unlocks_select_own"
  ON public.post_unlocks
  FOR SELECT
  USING (auth.uid() = fan_id);

CREATE POLICY IF NOT EXISTS "post_unlocks_insert_own"
  ON public.post_unlocks
  FOR INSERT
  WITH CHECK (auth.uid() = fan_id);

-------------------------
-- saved_posts
-------------------------

CREATE TABLE IF NOT EXISTS public.saved_posts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  fan_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (fan_id, post_id)
);

ALTER TABLE public.saved_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "saved_posts_select_own"
  ON public.saved_posts
  FOR SELECT
  USING (auth.uid() = fan_id);

CREATE POLICY IF NOT EXISTS "saved_posts_insert_own"
  ON public.saved_posts
  FOR INSERT
  WITH CHECK (auth.uid() = fan_id);

-------------------------
-- 通用触发器：updated_at 自动更新时间
-------------------------

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

DROP TRIGGER IF EXISTS set_creators_updated_at ON public.creators;
CREATE TRIGGER set_creators_updated_at
BEFORE UPDATE ON public.creators
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_posts_updated_at ON public.posts;
CREATE TRIGGER set_posts_updated_at
BEFORE UPDATE ON public.posts
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();
