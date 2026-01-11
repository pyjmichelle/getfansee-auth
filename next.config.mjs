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

export default nextConfig
