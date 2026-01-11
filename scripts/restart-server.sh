#!/bin/bash
# 重启开发服务器脚本

echo "🛑 停止现有服务器..."

# 查找并终止占用 3000 端口的进程
PID=$(lsof -ti:3000)
if [ -n "$PID" ]; then
  echo "发现进程 $PID，正在终止..."
  kill -9 $PID 2>/dev/null
  sleep 2
  echo "✅ 服务器已停止"
else
  echo "✅ 没有运行中的服务器"
fi

echo ""
echo "🚀 启动新服务器..."
echo "请在另一个终端运行: pnpm run dev"
echo "或者按 Ctrl+C 取消，然后手动运行 pnpm run dev"

