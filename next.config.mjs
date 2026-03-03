import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: process.env.NODE_ENV === 'development',
  },
  images: {
    // Allow remote images from Supabase storage and other CDN sources
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "**.supabase.in" },
    ],
  },
  // Remove X-Powered-By header to avoid leaking Next.js fingerprint
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: ['@phosphor-icons/react'],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Prevent tech stack inference via common headers
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
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
