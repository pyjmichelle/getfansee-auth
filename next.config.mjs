import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // 开发环境允许类型错误，生产环境必须修复
    ignoreBuildErrors: process.env.NODE_ENV === 'development',
  },
  images: {
    // 不使用 Next Image 优化（如果需要可以启用）
    unoptimized: true,
  },
  // 注释掉静态导出，Vercel 部署不需要
  // output: "export",
}

// Sentry 配置选项
const sentryWebpackPluginOptions = {
  // 静默模式：不在构建时上传 source maps（需要配置 SENTRY_AUTH_TOKEN）
  silent: true,

  // 组织和项目名称（从环境变量读取）
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // 仅在配置了 auth token 时上传 source maps
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // 隐藏 source maps（安全考虑）
  hideSourceMaps: true,
};

// 仅在配置了 Sentry DSN 时启用 Sentry
const exportedConfig = process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(nextConfig, sentryWebpackPluginOptions)
  : nextConfig;

export default exportedConfig
