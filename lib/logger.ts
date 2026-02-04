/**
 * 结构化日志工具
 * 提供统一的日志格式，支持请求追踪和金融审计
 *
 * 使用方法：
 * - logger.info("message", { userId, requestId })
 * - logger.error("message", error, { context })
 * - logger.financial("action", { userId, amount, ... })
 */

import * as Sentry from "@sentry/nextjs";

// 日志级别
type LogLevel = "debug" | "info" | "warn" | "error" | "audit";

// 日志上下文
interface LogContext {
  userId?: string;
  requestId?: string;
  endpoint?: string;
  [key: string]: unknown;
}

// 金融操作日志数据
interface FinancialLogData {
  userId: string;
  amount: number;
  type: "deposit" | "withdraw" | "ppv_unlock" | "subscription" | "refund" | "adjustment";
  status: "success" | "failure" | "pending";
  reason?: string;
  transactionId?: string;
  balanceBefore?: number;
  balanceAfter?: number;
  metadata?: Record<string, unknown>;
}

// 敏感字段列表（会被过滤）
const SENSITIVE_FIELDS = [
  "password",
  "oldPassword",
  "newPassword",
  "token",
  "accessToken",
  "refreshToken",
  "apiKey",
  "secret",
  "authorization",
  "cookie",
  "creditCard",
  "cardNumber",
  "cvv",
  "ssn",
];

/**
 * 过滤敏感信息
 */
function sanitizeData(data: unknown): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data !== "object") {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(sanitizeData);
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_FIELDS.some((field) => lowerKey.includes(field.toLowerCase()))) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeData(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * 格式化错误对象
 */
function formatError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    const result: Record<string, unknown> = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
    // 包含任何自定义属性（如 code, statusCode 等）
    const customError = error as Error & Record<string, unknown>;
    for (const key of Object.keys(customError)) {
      if (!["name", "message", "stack"].includes(key)) {
        result[key] = customError[key];
      }
    }
    return result;
  }
  return { message: String(error) };
}

/**
 * 创建结构化日志条目
 */
function createLogEntry(
  level: LogLevel,
  message: string,
  context?: LogContext,
  error?: unknown
): string {
  const entry: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level,
    message,
  };

  if (context) {
    entry.context = sanitizeData(context);
  }

  if (error) {
    entry.error = sanitizeData(formatError(error));
  }

  return JSON.stringify(entry);
}

/**
 * 日志工具类
 */
export const logger = {
  /**
   * 调试日志（仅开发环境）
   * 使用 console.warn 因为 ESLint 配置只允许 warn/error
   */
  debug(message: string, context?: LogContext): void {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.log(createLogEntry("debug", message, context));
    }
  },

  /**
   * 信息日志
   * 使用 console.warn 因为 ESLint 配置只允许 warn/error
   */
  info(message: string, context?: LogContext): void {
    // eslint-disable-next-line no-console
    console.log(createLogEntry("info", message, context));
  },

  /**
   * 警告日志
   */
  warn(message: string, context?: LogContext): void {
    console.warn(createLogEntry("warn", message, context));
  },

  /**
   * 错误日志（同时上报 Sentry）
   */
  error(message: string, error: unknown, context?: LogContext): void {
    console.error(createLogEntry("error", message, context, error));

    // 上报到 Sentry
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      Sentry.withScope((scope) => {
        if (context?.userId) {
          scope.setUser({ id: context.userId });
        }
        if (context?.requestId) {
          scope.setTag("requestId", context.requestId);
        }
        if (context) {
          scope.setExtras(sanitizeData(context) as Record<string, unknown>);
        }
        Sentry.captureException(error instanceof Error ? error : new Error(String(error)));
      });
    }
  },

  /**
   * 金融操作审计日志
   * 专门用于记录所有资金相关操作，便于审计追踪
   */
  financial(action: string, data: FinancialLogData): void {
    const sanitized = sanitizeData(data) as Record<string, unknown>;
    const entry = {
      timestamp: new Date().toISOString(),
      level: "audit" as const,
      action,
      ...sanitized,
    };

    // 金融日志始终输出
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(entry));

    // 如果是失败的金融操作，也上报 Sentry（但不作为错误，而是作为事件）
    if (data.status === "failure" && process.env.NEXT_PUBLIC_SENTRY_DSN) {
      Sentry.withScope((scope) => {
        scope.setLevel("warning");
        scope.setTag("type", "financial_audit");
        scope.setTag("action", action);
        scope.setTag("status", data.status);
        scope.setUser({ id: data.userId });
        scope.setExtras(sanitizeData(data) as Record<string, unknown>);
        Sentry.captureMessage(`Financial operation failed: ${action}`, "warning");
      });
    }
  },

  /**
   * API 请求日志
   * 用于记录 API 请求的开始和结束
   */
  apiRequest(params: {
    method: string;
    path: string;
    requestId?: string;
    userId?: string;
    duration?: number;
    status?: number;
    error?: unknown;
  }): void {
    const { method, path, requestId, userId, duration, status, error } = params;

    const entry = {
      timestamp: new Date().toISOString(),
      level: error ? "error" : "info",
      type: "api_request",
      method,
      path,
      requestId,
      userId,
      duration: duration ? `${duration}ms` : undefined,
      status,
      error: error ? sanitizeData(formatError(error)) : undefined,
    };

    // eslint-disable-next-line no-console
    console.log(JSON.stringify(entry));
  },
};

/**
 * 创建请求上下文
 * 从 NextRequest 或 headers 中提取追踪信息
 */
export function createRequestContext(
  request?: { headers: Headers } | null,
  userId?: string
): LogContext {
  const requestId =
    request?.headers.get("x-vercel-id") ||
    request?.headers.get("x-request-id") ||
    crypto.randomUUID();

  return {
    requestId,
    userId,
  };
}

export default logger;
