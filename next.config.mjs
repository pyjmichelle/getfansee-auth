/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    // FTP 静态导出，不使用 Next Image 优化
    unoptimized: true,
  },
  // 静态导出，配合 `next export` 生成 out/ 目录，便于 FTP 上传
  output: "export",
}

export default nextConfig
