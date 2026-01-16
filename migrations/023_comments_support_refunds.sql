-- 023_comments_support_refunds.sql
-- 评论系统 + 客服工单 + 退款申请

-- ============================================
-- 1. 评论系统
-- ============================================

CREATE TABLE IF NOT EXISTS public.post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS post_comments_post_id_idx ON public.post_comments(post_id);
CREATE INDEX IF NOT EXISTS post_comments_user_id_idx ON public.post_comments(user_id);
CREATE INDEX IF NOT EXISTS post_comments_created_at_idx ON public.post_comments(created_at DESC);

ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

-- SELECT: 所有认证用户可查看评论
DROP POLICY IF EXISTS post_comments_select_all ON public.post_comments;
CREATE POLICY post_comments_select_all
  ON public.post_comments
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: 订阅者或购买者可评论
DROP POLICY IF EXISTS post_comments_insert_authorized ON public.post_comments;
CREATE POLICY post_comments_insert_authorized
  ON public.post_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = post_id AND (
        -- Creator 自己的帖子
        p.creator_id = auth.uid()
        OR
        -- 已订阅
        EXISTS (
          SELECT 1 FROM public.subscriptions s
          WHERE s.subscriber_id = auth.uid()
            AND s.creator_id = p.creator_id
            AND s.status = 'active'
        )
        OR
        -- 已购买
        EXISTS (
          SELECT 1 FROM public.purchases pu
          WHERE pu.fan_id = auth.uid()
            AND pu.post_id = p.id
        )
      )
    )
  );

-- DELETE: 用户可删除自己的评论
DROP POLICY IF EXISTS post_comments_delete_own ON public.post_comments;
CREATE POLICY post_comments_delete_own
  ON public.post_comments
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ============================================
-- 2. 客服工单系统
-- ============================================

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  admin_response text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT support_tickets_status_check CHECK (status IN ('open', 'in_progress', 'resolved', 'closed'))
);

CREATE INDEX IF NOT EXISTS support_tickets_user_id_idx ON public.support_tickets(user_id);
CREATE INDEX IF NOT EXISTS support_tickets_status_idx ON public.support_tickets(status);
CREATE INDEX IF NOT EXISTS support_tickets_created_at_idx ON public.support_tickets(created_at DESC);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- SELECT: 用户可查看自己的工单，管理员可查看所有
DROP POLICY IF EXISTS support_tickets_select_own ON public.support_tickets;
CREATE POLICY support_tickets_select_own
  ON public.support_tickets
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- INSERT: 认证用户可创建工单
DROP POLICY IF EXISTS support_tickets_insert_own ON public.support_tickets;
CREATE POLICY support_tickets_insert_own
  ON public.support_tickets
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- UPDATE: 管理员可更新工单
DROP POLICY IF EXISTS support_tickets_update_admin ON public.support_tickets;
CREATE POLICY support_tickets_update_admin
  ON public.support_tickets
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- 3. 退款申请系统
-- ============================================

CREATE TABLE IF NOT EXISTS public.refund_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_id uuid NOT NULL REFERENCES public.transactions(id),
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT refund_requests_status_check CHECK (status IN ('pending', 'approved', 'rejected', 'processed'))
);

CREATE INDEX IF NOT EXISTS refund_requests_user_id_idx ON public.refund_requests(user_id);
CREATE INDEX IF NOT EXISTS refund_requests_transaction_id_idx ON public.refund_requests(transaction_id);
CREATE INDEX IF NOT EXISTS refund_requests_status_idx ON public.refund_requests(status);

ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;

-- SELECT: 用户可查看自己的退款申请，管理员可查看所有
DROP POLICY IF EXISTS refund_requests_select_own ON public.refund_requests;
CREATE POLICY refund_requests_select_own
  ON public.refund_requests
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- INSERT: 用户可为自己的交易创建退款申请
DROP POLICY IF EXISTS refund_requests_insert_own ON public.refund_requests;
CREATE POLICY refund_requests_insert_own
  ON public.refund_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND
    EXISTS (
      SELECT 1 FROM public.transactions
      WHERE id = transaction_id AND user_id = auth.uid()
    )
  );

-- UPDATE: 管理员可更新退款申请
DROP POLICY IF EXISTS refund_requests_update_admin ON public.refund_requests;
CREATE POLICY refund_requests_update_admin
  ON public.refund_requests
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- 4. 验证
-- ============================================

SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'post_comments') 
    THEN '✅ post_comments'
    ELSE '❌ post_comments missing'
  END,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'support_tickets') 
    THEN '✅ support_tickets'
    ELSE '❌ support_tickets missing'
  END,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'refund_requests') 
    THEN '✅ refund_requests'
    ELSE '❌ refund_requests missing'
  END;
