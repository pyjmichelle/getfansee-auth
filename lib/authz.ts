/**
 * 权限验证 Gate
 *
 * 提供可复用的权限检查函数，用于 API routes
 *
 * 使用方式：
 * ```typescript
 * export async function GET(request: NextRequest) {
 *   try {
 *     const { user, profile } = await requireAdmin();
 *     // ... 业务逻辑
 *   } catch (error) {
 *     return jsonError(error);
 *   }
 * }
 * ```
 */

import "server-only";

import { AppUser, getCurrentUser } from "./auth-server";
import { getProfile } from "./profile-server";
import { HttpError, Errors } from "./http-errors";

/**
 * Profile 类型（简化版，只包含权限检查需要的字段）
 */
export interface AuthProfile {
  id: string;
  email?: string;
  role: string;
  is_banned?: boolean;
  display_name?: string;
}

/**
 * 权限验证结果
 */
export interface AuthResult {
  user: AppUser;
  profile: AuthProfile;
}

/**
 * 要求用户已登录
 *
 * 检查：
 * 1. 存在有效的 session
 * 2. 用户未被封禁
 *
 * @throws HttpError 401 - 未登录
 * @throws HttpError 403 - 用户被封禁
 * @returns { user, profile }
 */
export async function requireUser(): Promise<AuthResult> {
  // 检查登录状态
  const user = await getCurrentUser();
  if (!user) {
    throw Errors.UNAUTHORIZED;
  }

  // 获取 profile
  const profile = await getProfile(user.id);
  if (!profile) {
    throw Errors.PROFILE_NOT_FOUND;
  }

  // 检查是否被封禁（profile.is_banned 可能不存在于旧数据库）
  const isBanned = "is_banned" in profile ? profile.is_banned : false;
  if (isBanned) {
    throw Errors.FORBIDDEN_BANNED;
  }

  return {
    user,
    profile: {
      id: profile.id,
      email: profile.email,
      role: profile.role,
      is_banned: isBanned,
      display_name: profile.display_name,
    },
  };
}

/**
 * 要求用户为管理员
 *
 * 检查：
 * 1. 存在有效的 session（401）
 * 2. 用户未被封禁（403）
 * 3. 用户角色为 admin（403）
 *
 * @throws HttpError 401 - 未登录
 * @throws HttpError 403 - 非管理员或被封禁
 * @returns { user, profile }
 */
export async function requireAdmin(): Promise<AuthResult> {
  const result = await requireUser();

  // 检查 admin 角色
  if (result.profile.role !== "admin") {
    throw Errors.FORBIDDEN_ADMIN;
  }

  return result;
}

/**
 * 要求用户为 Creator
 *
 * 检查：
 * 1. 存在有效的 session（401）
 * 2. 用户未被封禁（403）
 * 3. 用户角色为 creator（403）
 *
 * @throws HttpError 401 - 未登录
 * @throws HttpError 403 - 非 Creator 或被封禁
 * @returns { user, profile }
 */
export async function requireCreator(): Promise<AuthResult> {
  const result = await requireUser();

  // 检查 creator 角色
  if (result.profile.role !== "creator") {
    throw new HttpError(403, "FORBIDDEN_CREATOR", "Creator access required");
  }

  return result;
}

/**
 * 要求用户为资源所有者或管理员
 *
 * @param resourceOwnerId 资源所有者 ID
 * @throws HttpError 401 - 未登录
 * @throws HttpError 403 - 非所有者且非管理员
 * @returns { user, profile }
 */
export async function requireOwnerOrAdmin(resourceOwnerId: string): Promise<AuthResult> {
  const result = await requireUser();

  // 如果是所有者或管理员，允许访问
  if (result.user.id === resourceOwnerId || result.profile.role === "admin") {
    return result;
  }

  throw new HttpError(403, "FORBIDDEN_OWNER", "You do not have permission to access this resource");
}
