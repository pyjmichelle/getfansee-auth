/**
 * 环境变量校验（@t3-oss/env-nextjs + Zod）
 * - 构建/启动时校验，缺必需变量会直接报错
 * - 服务端仅能访问 server 段变量，客户端仅能访问 client 段变量
 */
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    /** Service Role Key，仅用于 lib/server/supabase-admin，调用处会再校验 */
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
    DIDIT_WEBHOOK_SECRET: z.string().optional(),
    CRON_SECRET: z.string().optional(),
    ALERT_SLACK_WEBHOOK: z.string().optional(),
    PENDING_STUCK_MINUTES: z.coerce.number().optional(),
    FAILED_TXN_THRESHOLD_COUNT: z.coerce.number().optional(),
    SENTRY_AUTH_TOKEN: z.string().optional(),
    SENTRY_ORG: z.string().optional(),
    SENTRY_PROJECT: z.string().optional(),
    /** E2E/Playwright 测试时由脚本或 CI 设置 */
    E2E: z.string().optional(),
    PLAYWRIGHT_TEST_MODE: z.string().optional(),
    E2E_ALLOW_ANY_HOST: z.string().optional(),
  },
  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.string().min(1, "NEXT_PUBLIC_SUPABASE_URL is required"),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
    NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
    NEXT_PUBLIC_POSTHOG_HOST: z.string().optional(),
    NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
    NEXT_PUBLIC_TEST_MODE: z.string().optional(),
    NEXT_PUBLIC_USE_MOCK_DATA: z.string().optional(),
    NEXT_PUBLIC_BASE_URL: z.string().optional(),
    NEXT_PUBLIC_APP_URL: z.string().optional(),
  },
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    DIDIT_WEBHOOK_SECRET: process.env.DIDIT_WEBHOOK_SECRET,
    CRON_SECRET: process.env.CRON_SECRET,
    ALERT_SLACK_WEBHOOK: process.env.ALERT_SLACK_WEBHOOK,
    PENDING_STUCK_MINUTES: process.env.PENDING_STUCK_MINUTES,
    FAILED_TXN_THRESHOLD_COUNT: process.env.FAILED_TXN_THRESHOLD_COUNT,
    SENTRY_AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN,
    SENTRY_ORG: process.env.SENTRY_ORG,
    SENTRY_PROJECT: process.env.SENTRY_PROJECT,
    E2E: process.env.E2E,
    PLAYWRIGHT_TEST_MODE: process.env.PLAYWRIGHT_TEST_MODE,
    E2E_ALLOW_ANY_HOST: process.env.E2E_ALLOW_ANY_HOST,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_TEST_MODE: process.env.NEXT_PUBLIC_TEST_MODE,
    NEXT_PUBLIC_USE_MOCK_DATA: process.env.NEXT_PUBLIC_USE_MOCK_DATA,
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
});
