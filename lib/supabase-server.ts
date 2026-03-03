/**
 * 服务端 Supabase 客户端（cookie 会话）
 * 实现位于 lib/server/，此处仅做 re-export 以保持现有 import 路径兼容。
 */
export { createClient, getSupabaseServerClient } from "@/lib/server/supabase-server";
