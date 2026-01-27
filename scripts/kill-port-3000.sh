#!/bin/bash
# Kill any process on port 3000
set -e

PORT=3000
PID=$(lsof -ti:$PORT 2>/dev/null || true)

if [ -n "$PID" ]; then
  echo "⚠️  Port $PORT is occupied by PID $PID"
  echo "   Killing process..."
  kill -9 $PID 2>/dev/null || true
  sleep 1
  echo "✅ Port $PORT cleared"
else
  echo "✅ Port $PORT is free"
fi

# Also clean up Next.js lock file
LOCK_FILE=".next/dev/lock"
if [ -f "$LOCK_FILE" ]; then
  rm -f "$LOCK_FILE"
  echo "✅ Removed $LOCK_FILE"
fi
