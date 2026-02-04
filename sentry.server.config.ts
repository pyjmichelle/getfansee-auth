/**
 * Sentry 服务端配置
 * 用于捕获 API Routes 和 Server Components 中的错误
 */

import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
const isTestMode =
  process.env.NEXT_PUBLIC_TEST_MODE === "true" || process.env.PLAYWRIGHT_TEST_MODE === "true";

// 仅在配置了 DSN 且不在测试模式下初始化
if (SENTRY_DSN && !isTestMode) {
  Sentry.init({
    dsn: SENTRY_DSN,

    // 环境标识
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "development",

    // 服务端采样率
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

    // 调试模式（开发环境）
    debug: process.env.NODE_ENV === "development",

    // 过滤敏感数据
    beforeSend(event) {
      // 移除可能包含敏感信息的 cookies
      if (event.request?.cookies) {
        delete event.request.cookies;
      }

      // 移除可能包含 token 的 headers
      if (event.request?.headers) {
        const sensitiveHeaders = ["authorization", "cookie", "x-auth-token"];
        sensitiveHeaders.forEach((header) => {
          if (event.request?.headers?.[header]) {
            event.request.headers[header] = "[Filtered]";
          }
        });
      }

      // 移除环境变量中的敏感信息
      if (event.extra) {
        const sensitiveKeys = ["SUPABASE_SERVICE_ROLE_KEY", "DIDIT_WEBHOOK_SECRET"];
        sensitiveKeys.forEach((key) => {
          if (event.extra?.[key]) {
            delete event.extra[key];
          }
        });
      }

      return event;
    },
  });
}
