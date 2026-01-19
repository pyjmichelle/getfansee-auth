-- 020_create_notifications_table.sql
-- 创建通知表（用于 022_notification_triggers.sql 的触发器）
-- Execute this in Supabase Dashboard SQL Editor

-- ============================================
-- 1. 创建 notifications 表
-- ============================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('subscription', 'payment', 'like', 'mention', 'system')),
  title text NOT NULL,
  message text NOT NULL,
  link text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

-- 启用 RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 索引
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread 
ON public.notifications(user_id, is_read, created_at DESC);

-- ============================================
-- 2. RLS 策略
-- ============================================

-- 用户只能查看自己的通知
DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own"
  ON public.notifications
  FOR SELECT
  USING (auth.uid() = user_id);

-- 用户只能更新自己的通知（标记已读）
DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own"
  ON public.notifications
  FOR UPDATE
  USING (auth.uid() = user_id);

-- 用户只能删除自己的通知
DROP POLICY IF EXISTS "notifications_delete_own" ON public.notifications;
CREATE POLICY "notifications_delete_own"
  ON public.notifications
  FOR DELETE
  USING (auth.uid() = user_id);

-- 允许触发器插入通知（使用 SECURITY DEFINER）
DROP POLICY IF EXISTS "notifications_insert_trigger" ON public.notifications;
CREATE POLICY "notifications_insert_trigger"
  ON public.notifications
  FOR INSERT
  WITH CHECK (true);

-- ============================================
-- 3. 验证
-- ============================================

SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'notifications'
    ) THEN '✅ notifications 表已创建'
    ELSE '❌ notifications 表创建失败'
  END AS status;
