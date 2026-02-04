-- 026_webhook_events.sql
-- Webhook 事件幂等去重表
-- 用于防止 webhook 重放攻击和重复处理
-- Execute this in Supabase Dashboard SQL Editor

-- ============================================
-- 1. 创建 webhook_events 表
-- ============================================

CREATE TABLE IF NOT EXISTS public.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- webhook 提供商（如 didit, stripe, etc）
  provider text NOT NULL,
  
  -- 事件 ID（来自 webhook payload 或计算得出）
  event_id text NOT NULL,
  
  -- payload 的 SHA256 哈希（用于验证和去重）
  payload_hash text NOT NULL,
  
  -- 接收时间
  received_at timestamptz NOT NULL DEFAULT now(),
  
  -- 处理状态
  status text NOT NULL DEFAULT 'processed' CHECK (status IN ('processed', 'failed', 'skipped')),
  
  -- 错误信息（如果处理失败）
  error_message text,
  
  -- 确保同一提供商的同一事件只处理一次
  UNIQUE(provider, event_id)
);

-- ============================================
-- 2. 创建索引
-- ============================================

-- 按提供商和时间查询
CREATE INDEX IF NOT EXISTS idx_webhook_events_provider_time 
  ON public.webhook_events(provider, received_at DESC);

-- 按状态查询失败的事件
CREATE INDEX IF NOT EXISTS idx_webhook_events_status 
  ON public.webhook_events(status) WHERE status = 'failed';

-- ============================================
-- 3. 启用 RLS
-- ============================================

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- 只有 service role 可以访问（通过 API routes）
-- 不创建任何 policy，意味着普通用户无法访问

-- ============================================
-- 4. 添加注释
-- ============================================

COMMENT ON TABLE public.webhook_events IS 'Webhook 事件记录表，用于幂等去重';
COMMENT ON COLUMN public.webhook_events.provider IS 'Webhook 提供商标识（如 didit, stripe）';
COMMENT ON COLUMN public.webhook_events.event_id IS '事件唯一标识（来自 payload 或计算得出）';
COMMENT ON COLUMN public.webhook_events.payload_hash IS 'payload 的 SHA256 哈希';
COMMENT ON COLUMN public.webhook_events.status IS '处理状态：processed=成功, failed=失败, skipped=跳过';

-- ============================================
-- 5. 创建清理过期事件的函数（可选）
-- ============================================

CREATE OR REPLACE FUNCTION cleanup_old_webhook_events(days_to_keep integer DEFAULT 30)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.webhook_events
  WHERE received_at < now() - (days_to_keep || ' days')::interval;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- ============================================
-- 6. 验证
-- ============================================

DO $$
DECLARE
  v_table_exists boolean;
  v_index_count integer;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'webhook_events'
  ) INTO v_table_exists;
  
  SELECT COUNT(*) INTO v_index_count
  FROM pg_indexes 
  WHERE schemaname = 'public' AND tablename = 'webhook_events';
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration 026 Verification:';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'webhook_events table exists: %', v_table_exists;
  RAISE NOTICE 'Index count: %', v_index_count;
  RAISE NOTICE '========================================';
END $$;
