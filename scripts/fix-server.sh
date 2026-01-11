#!/bin/bash
# 修复服务器脚本：重启卡住的服务器

echo "🔍 检查服务器状态..."

# 检查端口占用
PID=$(lsof -ti:3000)
if [ -n "$PID" ]; then
  echo "⚠️  发现占用 3000 端口的进程: $PID"
  echo "正在终止进程..."
  kill -9 $PID 2>/dev/null
  sleep 2
  echo "✅ 进程已终止"
else
  echo "✅ 端口 3000 未被占用"
fi

echo ""
echo "🚀 启动开发服务器..."
echo "请在另一个终端运行: pnpm run dev"
echo "或者运行此脚本后会自动启动（取消下面的注释）"
# pnpm run dev

