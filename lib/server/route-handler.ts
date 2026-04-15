import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, type AppUser } from "@/lib/server/auth-server";

/** 统一 API 错误 JSON 格式 */
export type ApiErrorBody = {
  error: string;
  code?: string;
};

/**
 * 返回统一格式的 JSON 错误响应
 */
export function jsonError(
  message: string,
  status: number,
  options?: { code?: string }
): NextResponse<ApiErrorBody> {
  const body: ApiErrorBody = { error: message };
  if (options?.code) body.code = options.code;
  return NextResponse.json(body, { status });
}

/** 401 Unauthorized：未登录 */
export function unauthorized(message = "Unauthorized"): NextResponse<ApiErrorBody> {
  return jsonError(message, 401, { code: "UNAUTHORIZED" });
}

/** 403 Forbidden：无权限 */
export function forbidden(message = "Forbidden"): NextResponse<ApiErrorBody> {
  return jsonError(message, 403, { code: "FORBIDDEN" });
}

/** 400 Bad Request */
export function badRequest(message: string): NextResponse<ApiErrorBody> {
  return jsonError(message, 400, { code: "BAD_REQUEST" });
}

/** 500 Internal Server Error */
export function serverError(message = "Internal server error"): NextResponse<ApiErrorBody> {
  return jsonError(message, 500, { code: "INTERNAL_ERROR" });
}

export type WithAuthContext = {
  user: AppUser;
};

export type AuthenticatedRouteHandler = (
  request: NextRequest,
  context: WithAuthContext
) => Promise<NextResponse> | NextResponse;

function isSensitiveMessage(msg: string): boolean {
  const lower = msg.toLowerCase();
  return (
    lower.includes("is not configured") ||
    lower.includes("service_role") ||
    lower.includes("secret") ||
    lower.includes("api_key") ||
    lower.includes(".env")
  );
}

export function sanitizeErrorForClient(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  if (isSensitiveMessage(msg)) {
    return "Service temporarily unavailable. Please try again later.";
  }
  return msg;
}

/**
 * 包装需要登录的 Route Handler：自动取当前用户，未登录则返回 401 统一 JSON。
 * 同时在外层 catch 中过滤敏感错误信息。
 */
export function withAuth(handler: AuthenticatedRouteHandler) {
  return async function wrapped(request: NextRequest): Promise<NextResponse> {
    try {
      const user = await getCurrentUser();
      if (!user) {
        return unauthorized();
      }
      return await handler(request, { user });
    } catch (err) {
      console.error("[withAuth] Unhandled error:", err);
      return serverError(sanitizeErrorForClient(err));
    }
  };
}
