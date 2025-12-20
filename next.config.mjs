/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    // 不使用 Next Image 优化（如果需要可以启用）
    unoptimized: true,
  },
  // 注释掉静态导出，Vercel 部署不需要
  // output: "export",
}

export default nextConfig
