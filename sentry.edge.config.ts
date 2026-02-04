/**
 * Sentry Edge Runtime 配置
 * 用于 Middleware 和 Edge Functions
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

    // Edge 采样率
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  });
}
