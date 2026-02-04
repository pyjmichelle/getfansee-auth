/**
 * HTTP 错误处理工具
 *
 * 提供统一的错误类和响应格式
 */

import { NextResponse } from "next/server";

/**
 * HTTP 错误类
 * 用于在 API routes 中抛出可预期的错误
 */
export class HttpError extends Error {
  public readonly status: number;
  public readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
  }

  /**
   * 转换为 JSON 响应对象
   */
  toJSON(): { error: string; code: string; message: string } {
    return {
      error: this.code,
      code: this.code,
      message: this.message,
    };
  }
}

/**
 * 预定义的 HTTP 错误
 */
export const Errors = {
  // 401 Unauthorized - 未登录
  UNAUTHORIZED: new HttpError(401, "UNAUTHORIZED", "Authentication required"),

  // 403 Forbidden - 无权限
  FORBIDDEN: new HttpError(403, "FORBIDDEN", "Access denied"),
  FORBIDDEN_ADMIN: new HttpError(403, "FORBIDDEN_ADMIN", "Admin access required"),
  FORBIDDEN_BANNED: new HttpError(403, "FORBIDDEN_BANNED", "Account is banned"),

  // 404 Not Found
  NOT_FOUND: new HttpError(404, "NOT_FOUND", "Resource not found"),
  PROFILE_NOT_FOUND: new HttpError(404, "PROFILE_NOT_FOUND", "User profile not found"),

  // 400 Bad Request
  BAD_REQUEST: new HttpError(400, "BAD_REQUEST", "Invalid request"),

  // 500 Internal Server Error
  INTERNAL_ERROR: new HttpError(500, "INTERNAL_ERROR", "Internal server error"),
} as const;

/**
 * 创建自定义 HTTP 错误
 */
export function createHttpError(status: number, code: string, message: string): HttpError {
  return new HttpError(status, code, message);
}

/**
 * 将错误转换为 JSON 响应
 *
 * @param error 错误对象
 * @param requestId 可选的请求 ID（用于追踪）
 * @returns NextResponse
 */
export function jsonError(
  error: unknown,
  requestId?: string
): NextResponse<{ error: string; code: string; message: string; requestId?: string }> {
  // HttpError - 预期的业务错误
  if (error instanceof HttpError) {
    const body: { error: string; code: string; message: string; requestId?: string } = {
      ...error.toJSON(),
    };
    if (requestId) {
      body.requestId = requestId;
    }
    return NextResponse.json(body, { status: error.status });
  }

  // 标准 Error - 未预期的错误
  if (error instanceof Error) {
    const body: { error: string; code: string; message: string; requestId?: string } = {
      error: "INTERNAL_ERROR",
      code: "INTERNAL_ERROR",
      message:
        process.env.NODE_ENV === "development" ? error.message : "An unexpected error occurred",
    };
    if (requestId) {
      body.requestId = requestId;
    }
    return NextResponse.json(body, { status: 500 });
  }

  // 未知错误类型
  const body: { error: string; code: string; message: string; requestId?: string } = {
    error: "INTERNAL_ERROR",
    code: "INTERNAL_ERROR",
    message: "An unexpected error occurred",
  };
  if (requestId) {
    body.requestId = requestId;
  }
  return NextResponse.json(body, { status: 500 });
}
