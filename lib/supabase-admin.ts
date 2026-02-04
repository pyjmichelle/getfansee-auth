/**
 * Supabase Admin Client（Service Role）
 *
 * 重要安全说明：
 * 1. 这是全仓唯一允许使用 SUPABASE_SERVICE_ROLE_KEY 的文件
 * 2. 只能在服务端使用（server-only）
 * 3. 用于需要绕过 RLS 的管理操作（如 admin、cron、webhook）
 * 4. 绝不能在客户端代码中导入
 *
 * 使用场景：
 * - Admin API 操作
 * - Cron Job 审计
 * - Webhook 处理
 * - 数据迁移脚本
 */

import "server-only";

import { createClient, SupabaseClient } from "@supabase/supabase-js";

// 单例实例
let adminClient: SupabaseClient | null = null;

/**
 * 获取 Supabase Admin Client（使用 Service Role Key）
 *
 * 特点：
 * - 绕过所有 RLS 策略
 * - 拥有完整的数据库访问权限
 * - 只能在服务端使用
 *
 * @returns Supabase Admin Client
 * @throws Error 如果环境变量未配置
 */
export function getSupabaseAdminClient(): SupabaseClient {
  if (adminClient) {
    return adminClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error(
      "[supabase-admin] NEXT_PUBLIC_SUPABASE_URL is not configured. " +
        "Please check your environment variables."
    );
  }

  if (!supabaseServiceKey) {
    throw new Error(
      "[supabase-admin] SUPABASE_SERVICE_ROLE_KEY is not configured. " +
        "Please check your environment variables."
    );
  }

  adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return adminClient;
}

/**
 * 重置 Admin Client（仅用于测试）
 */
export function resetAdminClient(): void {
  adminClient = null;
}
