/**
 * Supabase Admin Client（Service Role）
 * 实现位于 lib/server/，此处仅做 re-export。
 * 全仓唯一允许使用 SUPABASE_SERVICE_ROLE_KEY 的模块在 lib/server/supabase-admin.ts
 */
export { getSupabaseAdminClient, resetAdminClient } from "@/lib/server/supabase-admin";
