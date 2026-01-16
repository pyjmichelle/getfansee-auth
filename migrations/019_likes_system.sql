-- 019_likes_system.sql
-- 点赞系统
-- 支持帖子点赞功能

-- ============================================
-- 1. 创建 post_likes 表
-- ============================================

CREATE TABLE IF NOT EXISTS public.post_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE(post_id, user_id)
);

-- 创建索引以优化查询
CREATE INDEX IF NOT EXISTS post_likes_post_id_idx ON public.post_likes(post_id);
CREATE INDEX IF NOT EXISTS post_likes_user_id_idx ON public.post_likes(user_id);

-- ============================================
-- 2. 在 posts 表添加 likes_count 缓存列
-- ============================================

ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS likes_count integer NOT NULL DEFAULT 0;

-- ============================================
-- 3. 启用 RLS
-- ============================================

ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 4. post_likes RLS 策略
-- ============================================

-- SELECT: 所有认证用户可查看点赞记录
DROP POLICY IF EXISTS post_likes_select_all ON public.post_likes;
CREATE POLICY post_likes_select_all
  ON public.post_likes
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: 用户只能为自己创建点赞
DROP POLICY IF EXISTS post_likes_insert_own ON public.post_likes;
CREATE POLICY post_likes_insert_own
  ON public.post_likes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- DELETE: 用户只能删除自己的点赞
DROP POLICY IF EXISTS post_likes_delete_own ON public.post_likes;
CREATE POLICY post_likes_delete_own
  ON public.post_likes
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================
-- 5. 触发器：自动更新 posts.likes_count
-- ============================================

-- 增加点赞计数
CREATE OR REPLACE FUNCTION increment_post_likes_count()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.posts
  SET likes_count = likes_count + 1
  WHERE id = NEW.post_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 减少点赞计数
CREATE OR REPLACE FUNCTION decrement_post_likes_count()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.posts
  SET likes_count = GREATEST(likes_count - 1, 0)
  WHERE id = OLD.post_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
DROP TRIGGER IF EXISTS post_likes_increment_trigger ON public.post_likes;
CREATE TRIGGER post_likes_increment_trigger
AFTER INSERT ON public.post_likes
FOR EACH ROW
EXECUTE FUNCTION increment_post_likes_count();

DROP TRIGGER IF EXISTS post_likes_decrement_trigger ON public.post_likes;
CREATE TRIGGER post_likes_decrement_trigger
AFTER DELETE ON public.post_likes
FOR EACH ROW
EXECUTE FUNCTION decrement_post_likes_count();

-- ============================================
-- 6. 初始化现有帖子的点赞计数（如果需要）
-- ============================================

-- 如果数据库中已有点赞数据，运行此更新
UPDATE public.posts
SET likes_count = (
  SELECT COUNT(*)
  FROM public.post_likes
  WHERE post_id = posts.id
)
WHERE likes_count = 0;

-- ============================================
-- 7. 授予权限
-- ============================================

GRANT EXECUTE ON FUNCTION increment_post_likes_count() TO authenticated;
GRANT EXECUTE ON FUNCTION decrement_post_likes_count() TO authenticated;

-- ============================================
-- 8. 验证
-- ============================================

-- 验证表创建
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'post_likes'
    ) THEN '✅ post_likes 表已创建'
    ELSE '❌ post_likes 表创建失败'
  END AS likes_table_status;

-- 验证 posts.likes_count 列
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'posts' 
        AND column_name = 'likes_count'
    ) THEN '✅ posts.likes_count 列已添加'
    ELSE '❌ posts.likes_count 列添加失败'
  END AS likes_count_column_status;

-- 验证 RLS 已启用
SELECT 
  CASE 
    WHEN relrowsecurity THEN '✅ post_likes RLS 已启用'
    ELSE '❌ post_likes RLS 未启用'
  END AS rls_status
FROM pg_class
WHERE relname = 'post_likes' AND relnamespace = 'public'::regnamespace;
