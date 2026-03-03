/**
 * Supabase Admin Client（Service Role）
 *
 * 重要安全说明：
 * 1. 这是全仓唯一允许使用 SUPABASE_SERVICE_ROLE_KEY 的文件
 * 2. 只能在服务端使用（server-only）
 * 3. 用于需要绕过 RLS 的管理操作（如 admin、cron、webhook）
 * 4. 绝不能在客户端代码中导入
 */

import "server-only";

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

let adminClient: SupabaseClient | null = null;

export function getSupabaseAdminClient(): SupabaseClient {
  if (adminClient) {
    return adminClient;
  }

  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseServiceKey) {
    throw new Error(
      "[supabase-admin] SUPABASE_SERVICE_ROLE_KEY is not configured. " +
        "Please set it in .env.local when using admin operations."
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

export function resetAdminClient(): void {
  adminClient = null;
}
