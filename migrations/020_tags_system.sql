-- 020_tags_system.sql
-- 标签系统
-- 支持内容标签和 Creator 标签，用于分类和搜索

-- ============================================
-- 1. 创建 tags 表
-- ============================================

CREATE TABLE IF NOT EXISTS public.tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  slug text UNIQUE NOT NULL, -- URL 友好的标识符
  category text NOT NULL, -- 'content' | 'creator'
  description text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT tags_category_check CHECK (category IN ('content', 'creator'))
);

-- 创建索引
CREATE INDEX IF NOT EXISTS tags_category_idx ON public.tags(category);
CREATE INDEX IF NOT EXISTS tags_slug_idx ON public.tags(slug);

-- ============================================
-- 2. 创建 post_tags 表 (内容标签)
-- ============================================

CREATE TABLE IF NOT EXISTS public.post_tags (
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (post_id, tag_id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS post_tags_post_id_idx ON public.post_tags(post_id);
CREATE INDEX IF NOT EXISTS post_tags_tag_id_idx ON public.post_tags(tag_id);

-- ============================================
-- 3. 创建 creator_tags 表 (Creator 标签)
-- ============================================

CREATE TABLE IF NOT EXISTS public.creator_tags (
  creator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (creator_id, tag_id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS creator_tags_creator_id_idx ON public.creator_tags(creator_id);
CREATE INDEX IF NOT EXISTS creator_tags_tag_id_idx ON public.creator_tags(tag_id);

-- ============================================
-- 4. 启用 RLS
-- ============================================

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_tags ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. tags RLS 策略
-- ============================================

-- SELECT: 所有认证用户可查看标签
DROP POLICY IF EXISTS tags_select_all ON public.tags;
CREATE POLICY tags_select_all
  ON public.tags
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT/UPDATE/DELETE: 仅管理员可管理标签（暂时允许所有用户）
DROP POLICY IF EXISTS tags_manage_all ON public.tags;
CREATE POLICY tags_manage_all
  ON public.tags
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================
-- 6. post_tags RLS 策略
-- ============================================

-- SELECT: 所有认证用户可查看帖子标签
DROP POLICY IF EXISTS post_tags_select_all ON public.post_tags;
CREATE POLICY post_tags_select_all
  ON public.post_tags
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: Creator 可为自己的帖子添加标签
DROP POLICY IF EXISTS post_tags_insert_own ON public.post_tags;
CREATE POLICY post_tags_insert_own
  ON public.post_tags
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.posts
      WHERE id = post_id AND creator_id = auth.uid()
    )
  );

-- DELETE: Creator 可删除自己帖子的标签
DROP POLICY IF EXISTS post_tags_delete_own ON public.post_tags;
CREATE POLICY post_tags_delete_own
  ON public.post_tags
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.posts
      WHERE id = post_id AND creator_id = auth.uid()
    )
  );

-- ============================================
-- 7. creator_tags RLS 策略
-- ============================================

-- SELECT: 所有认证用户可查看 Creator 标签
DROP POLICY IF EXISTS creator_tags_select_all ON public.creator_tags;
CREATE POLICY creator_tags_select_all
  ON public.creator_tags
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: Creator 可为自己添加标签
DROP POLICY IF EXISTS creator_tags_insert_own ON public.creator_tags;
CREATE POLICY creator_tags_insert_own
  ON public.creator_tags
  FOR INSERT
  TO authenticated
  WITH CHECK (creator_id = auth.uid());

-- DELETE: Creator 可删除自己的标签
DROP POLICY IF EXISTS creator_tags_delete_own ON public.creator_tags;
CREATE POLICY creator_tags_delete_own
  ON public.creator_tags
  FOR DELETE
  TO authenticated
  USING (creator_id = auth.uid());

-- ============================================
-- 8. 预设标签
-- ============================================

-- Creator 类型标签
INSERT INTO public.tags (name, slug, category, description) VALUES
  ('Photography', 'photography', 'creator', 'Photography and visual arts'),
  ('Fitness', 'fitness', 'creator', 'Fitness and health content'),
  ('Fashion', 'fashion', 'creator', 'Fashion and style content'),
  ('Gaming', 'gaming', 'creator', 'Gaming and esports content'),
  ('Music', 'music', 'creator', 'Music and audio content'),
  ('Art', 'art', 'creator', 'Art and creative content'),
  ('Lifestyle', 'lifestyle', 'creator', 'Lifestyle and daily content'),
  ('Adult', 'adult', 'creator', 'Adult content (18+)')
ON CONFLICT (name) DO NOTHING;

-- 内容类型标签
INSERT INTO public.tags (name, slug, category, description) VALUES
  ('Behind the Scenes', 'behind-the-scenes', 'content', 'Behind the scenes content'),
  ('Tutorial', 'tutorial', 'content', 'Educational tutorials'),
  ('Exclusive', 'exclusive', 'content', 'Exclusive premium content'),
  ('Live Stream', 'live-stream', 'content', 'Live streaming content'),
  ('Q&A', 'qa', 'content', 'Question and answer sessions'),
  ('Photo Set', 'photo-set', 'content', 'Photo collection'),
  ('Video', 'video', 'content', 'Video content'),
  ('Audio', 'audio', 'content', 'Audio content')
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- 9. 验证
-- ============================================

-- 验证表创建
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'tags'
    ) THEN '✅ tags 表已创建'
    ELSE '❌ tags 表创建失败'
  END AS tags_status;

SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'post_tags'
    ) THEN '✅ post_tags 表已创建'
    ELSE '❌ post_tags 表创建失败'
  END AS post_tags_status;

SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'creator_tags'
    ) THEN '✅ creator_tags 表已创建'
    ELSE '❌ creator_tags 表创建失败'
  END AS creator_tags_status;

-- 验证预设标签
SELECT 
  COUNT(*) as tag_count,
  COUNT(CASE WHEN category = 'creator' THEN 1 END) as creator_tags,
  COUNT(CASE WHEN category = 'content' THEN 1 END) as content_tags
FROM public.tags;
