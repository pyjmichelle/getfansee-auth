#!/bin/bash

# 部署脚本 - 适用于自托管服务器
# 使用方法: ./deploy.sh

set -e

echo "🚀 开始部署到生产环境..."

# 1. 拉取最新代码
echo "📥 拉取最新代码..."
git pull origin main

# 2. 安装依赖
echo "📦 安装依赖..."
pnpm install --frozen-lockfile

# 3. 构建项目
echo "🔨 构建项目..."
pnpm build

# 4. 重启 PM2 进程 (如果使用 PM2)
if command -v pm2 &> /dev/null; then
    echo "🔄 重启 PM2 进程..."
    pm2 restart getfansee-auth || pm2 start npm --name "getfansee-auth" -- start
    pm2 save
else
    echo "⚠️  PM2 未安装，跳过进程管理"
fi

echo "✅ 部署完成！"
echo "🌐 访问: http://mvp.getfansee.com"
