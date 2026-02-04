/**
 * Sentry 客户端配置
 * 用于捕获前端 JavaScript 错误
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

    // 采样率配置
    // 生产环境采样 10% 的事务用于性能监控
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

    // Replay 采样率（可选）
    // 捕获 10% 的会话回放，错误会话 100% 回放
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

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

      return event;
    },

    // 忽略某些错误
    ignoreErrors: [
      // 浏览器扩展错误
      "chrome-extension://",
      "moz-extension://",
      // 网络错误（通常是用户网络问题）
      "Network request failed",
      "Failed to fetch",
      // ResizeObserver 循环错误（通常无害）
      "ResizeObserver loop limit exceeded",
    ],
  });
}
