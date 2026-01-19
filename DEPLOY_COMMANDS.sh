#!/bin/bash
# 部署命令 - 复制粘贴执行

echo "🚀 MVP 部署到 mvp.getfansee.com"
echo ""
echo "服务器信息:"
echo "  IP: 67.223.118.208"
echo "  端口: 21098"
echo "  用户: getfkpmx"
echo ""

# 步骤 1: 上传文件
echo "步骤 1/3: 上传文件到服务器..."
rsync -avz --delete \
  -e "ssh -p 21098" \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='.env.local' \
  --exclude='.next/cache' \
  --exclude='tests' \
  --exclude='docs' \
  --exclude='scripts' \
  .next package.json pnpm-lock.yaml public app components lib middleware.ts next.config.mjs \
  getfkpmx@67.223.118.208:/home/getfkpmx/mvp/

echo ""
echo "步骤 2/3: 上传环境变量..."
scp -P 21098 .env.local getfkpmx@67.223.118.208:/home/getfkpmx/mvp/.env.production

echo ""
echo "步骤 3/3: 在服务器上安装依赖并启动..."
echo "请手动执行以下命令:"
echo ""
echo "ssh -p 21098 getfkpmx@67.223.118.208"
echo "cd /home/getfkpmx/mvp"
echo "pnpm install --prod"
echo "pm2 restart mvp || pm2 start pnpm --name mvp -- start"
echo "pm2 logs mvp"
