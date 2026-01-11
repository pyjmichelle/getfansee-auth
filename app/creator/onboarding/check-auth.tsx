import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-server";
import { getProfile } from "@/lib/profile-server";

/**
 * 服务端组件：检查认证和权限
 * 用于 Creator 路由的权限保护
 */
export async function checkCreatorAuth() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth");
  }

  const profile = await getProfile(user.id);
  // 注意：onboarding 页面允许所有已登录用户访问（用于创建 creator profile）
  // 其他 creator 路由应该检查 role === "creator"

  return { user, profile };
}
