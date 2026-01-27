#!/bin/bash
# Check if dev server is running on port 3000
set -e

PORT=3000
BASE_URL="http://127.0.0.1:$PORT"

echo "🔍 Checking if dev server is running on port $PORT..."

# Check if port is listening (lsof preferred; fallback to ss/netstat)
if command -v lsof > /dev/null 2>&1; then
  if ! lsof -i:$PORT -sTCP:LISTEN > /dev/null 2>&1; then
    echo "❌ Error: Dev server is NOT running on port $PORT"
    echo ""
    echo "   Please start the dev server first:"
    echo "   → pnpm dev"
    echo ""
    exit 1
  fi
elif command -v ss > /dev/null 2>&1; then
  if ! ss -ltn "sport = :$PORT" | grep -q LISTEN; then
    echo "❌ Error: Dev server is NOT running on port $PORT"
    echo ""
    echo "   Please start the dev server first:"
    echo "   → pnpm dev"
    echo ""
    exit 1
  fi
elif command -v netstat > /dev/null 2>&1; then
  if ! netstat -ltn 2>/dev/null | grep -q ":$PORT"; then
    echo "❌ Error: Dev server is NOT running on port $PORT"
    echo ""
    echo "   Please start the dev server first:"
    echo "   → pnpm dev"
    echo ""
    exit 1
  fi
else
  echo "⚠️  No port-check tool available (lsof/ss/netstat). Skipping port check."
fi

# Check if /api/health responds
if curl -sf "$BASE_URL/api/health" > /dev/null 2>&1; then
  echo "✅ Dev server is running and responding on port $PORT"
  exit 0
else
  echo "⚠️  Port $PORT is in use but server not responding"
  echo "   Trying to check homepage..."
  
  if curl -sf "$BASE_URL" > /dev/null 2>&1; then
    echo "✅ Homepage responds (server might still be starting)"
    exit 0
  else
    echo "❌ Server not responding properly"
    exit 1
  fi
fi
