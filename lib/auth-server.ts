/**
 * 服务端认证与当前用户
 * 实现位于 lib/server/，此处仅做 re-export。
 */
export type { AppUser } from "@/lib/server/auth-server";
export { getCurrentUser, ensureProfile } from "@/lib/server/auth-server";
