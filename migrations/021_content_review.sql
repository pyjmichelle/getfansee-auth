-- 021_content_review.sql
-- 内容审核系统
-- Creator 发布内容需要审核后才能公开

-- ============================================
-- 1. 在 posts 表添加审核相关列
-- ============================================

ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'pending';

ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id);

ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS rejection_reason text;

-- 添加约束
ALTER TABLE public.posts 
DROP CONSTRAINT IF EXISTS posts_review_status_check;

ALTER TABLE public.posts 
ADD CONSTRAINT posts_review_status_check 
CHECK (review_status IN ('pending', 'approved', 'rejected'));

-- 创建索引
CREATE INDEX IF NOT EXISTS posts_review_status_idx ON public.posts(review_status);

-- ============================================
-- 2. 更新 posts RLS 策略：只有approved的帖子对其他用户可见
-- ============================================

-- 先删除旧的 SELECT 策略
DROP POLICY IF EXISTS posts_select_visible ON public.posts;

-- 新的 SELECT 策略：Creator 可以看到自己的所有帖子，其他用户只能看到 approved 的帖子
CREATE POLICY posts_select_visible
  ON public.posts
  FOR SELECT
  USING (
    -- Creator 可以看到自己的所有帖子（包括 pending/rejected）
    creator_id = auth.uid()
    OR
    -- 其他用户只能看到 approved 的帖子
    (
      review_status = 'approved'
      AND (
        -- Free 帖子
        visibility = 'free'
        OR
        -- Subscriber-only 帖子需要订阅
        (
          visibility = 'subscribers' AND EXISTS (
            SELECT 1 FROM public.subscriptions
            WHERE subscriber_id = auth.uid()
              AND creator_id = posts.creator_id
              AND status = 'active'
              AND current_period_end > timezone('utc', now())
          )
        )
        OR
        -- PPV 帖子需要购买
        (
          visibility = 'ppv' AND EXISTS (
            SELECT 1 FROM public.purchases
            WHERE fan_id = auth.uid()
              AND post_id = posts.id
          )
        )
      )
    )
  );

-- ============================================
-- 3. 创建审核日志表（可选，用于审计）
-- ============================================

CREATE TABLE IF NOT EXISTS public.content_review_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES auth.users(id),
  action text NOT NULL, -- 'approved' | 'rejected'
  reason text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT content_review_logs_action_check CHECK (action IN ('approved', 'rejected'))
);

-- 创建索引
CREATE INDEX IF NOT EXISTS content_review_logs_post_id_idx ON public.content_review_logs(post_id);
CREATE INDEX IF NOT EXISTS content_review_logs_reviewer_id_idx ON public.content_review_logs(reviewer_id);

-- 启用 RLS
ALTER TABLE public.content_review_logs ENABLE ROW LEVEL SECURITY;

-- RLS 策略：只有管理员可以查看审核日志
DROP POLICY IF EXISTS content_review_logs_admin_only ON public.content_review_logs;
CREATE POLICY content_review_logs_admin_only
  ON public.content_review_logs
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- 4. 将现有帖子标记为 approved（向后兼容）
-- ============================================

UPDATE public.posts
SET review_status = 'approved'
WHERE review_status = 'pending';

-- ============================================
-- 5. 验证
-- ============================================

-- 验证列添加
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'posts'
  AND column_name IN ('review_status', 'reviewed_by', 'reviewed_at', 'rejection_reason');

-- 验证审核日志表
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'content_review_logs'
    ) THEN '✅ content_review_logs 表已创建'
    ELSE '❌ content_review_logs 表创建失败'
  END AS review_logs_status;

-- 统计各状态的帖子数量
SELECT 
  review_status,
  COUNT(*) as count
FROM public.posts
GROUP BY review_status;
