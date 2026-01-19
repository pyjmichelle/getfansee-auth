#!/bin/bash
# MVP 部署脚本
# 使用方法: ./scripts/deploy-mvp.sh

set -e

# 服务器配置
SSH_HOST="67.223.118.208"
SSH_USER="getfkpmx"
SSH_PORT="21098"
DEPLOY_PATH="/home/getfkpmx/mvp"

echo "🚀 Starting MVP deployment to mvp.getfansee.com..."
echo "   Server: $SSH_HOST:$SSH_PORT"
echo "   User: $SSH_USER"
echo "   Path: $DEPLOY_PATH"
echo ""

# 1. 构建项目
echo "📦 Building project..."
pnpm build

# 2. 检查构建是否成功
if [ ! -d ".next" ]; then
  echo "❌ Build failed - .next directory not found"
  exit 1
fi

echo "✅ Build successful"

# 3. 创建部署目录（如果不存在）
echo "📁 Creating deployment directory on server..."
ssh -p $SSH_PORT $SSH_USER@$SSH_HOST "mkdir -p $DEPLOY_PATH"

# 4. 部署到服务器
echo "📤 Deploying files to server..."
rsync -avz --delete \
  -e "ssh -p $SSH_PORT" \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='.env.local' \
  --exclude='.next/cache' \
  --exclude='tests' \
  --exclude='e2e' \
  --exclude='docs' \
  --exclude='scripts' \
  .next package.json pnpm-lock.yaml public app components lib migrations \
  $SSH_USER@$SSH_HOST:$DEPLOY_PATH/

# 5. 上传环境变量文件
echo "🔐 Uploading environment variables..."
scp -P $SSH_PORT .env.local $SSH_USER@$SSH_HOST:$DEPLOY_PATH/.env.production

# 6. 安装依赖并重启服务
echo "🔄 Installing dependencies and restarting server..."
ssh -p $SSH_PORT $SSH_USER@$SSH_HOST << 'ENDSSH'
cd /home/getfkpmx/mvp
echo "Installing dependencies..."
pnpm install --prod

# 检查是否有 PM2
if command -v pm2 &> /dev/null; then
  echo "Restarting with PM2..."
  pm2 restart mvp || pm2 start pnpm --name mvp -- start
else
  echo "PM2 not found, starting with pnpm..."
  # 杀死旧进程
  pkill -f "next start" || true
  # 后台启动
  nohup pnpm start > /dev/null 2>&1 &
fi
ENDSSH

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📋 Next steps:"
echo "1. Verify the site at https://mvp.getfansee.com"
echo "2. Check server logs: ssh -p $SSH_PORT $SSH_USER@$SSH_HOST 'pm2 logs mvp'"
echo "3. Run acceptance test against production"
