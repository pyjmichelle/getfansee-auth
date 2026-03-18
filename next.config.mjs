import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: process.env.NODE_ENV === 'development',
  },
  images: {
    // Allow remote images from Supabase storage and other CDN sources
    unoptimized: process.env.NEXT_PUBLIC_TEST_MODE === "true",
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "**.supabase.in" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "ui-avatars.com" },
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "fastly.picsum.photos" },
    ],
  },
  // Remove X-Powered-By header to avoid leaking Next.js fingerprint
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: ['react-coolicons'],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Prevent tech stack inference
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // HSTS: enforce HTTPS for 1 year, include subdomains
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
          // Permissions Policy: restrict browser features not needed by the app
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          // Content Security Policy
          // Note: 'unsafe-inline' for styles is required by Tailwind CSS / shadcn.
          // Script 'unsafe-eval' is required by some Next.js internals in development.
          // Tighten nonces in a future iteration once a nonce-based CSP is implemented.
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.posthog.com https://app.posthog.com https://cdn.vercel-insights.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in https://images.unsplash.com https://ui-avatars.com https://picsum.photos https://fastly.picsum.photos",
              "connect-src 'self' https://*.supabase.co https://*.supabase.in wss://*.supabase.co https://app.posthog.com https://vitals.vercel-insights.com https://cdn.vercel-insights.com",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "upgrade-insecure-requests",
            ].join("; "),
          },
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
