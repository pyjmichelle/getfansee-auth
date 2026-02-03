#!/usr/bin/env bash
# Start E2E server on port 3000: clear port, build, start.
# Output is visible (no redirect). Use in terminal 1; run tests in terminal 2.
# Mac/Linux compatible.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

PORT=3000

# Clear port 3000 if in use: TERM first, then KILL if still alive
if command -v lsof >/dev/null 2>&1; then
  PID=$(lsof -ti:$PORT 2>/dev/null || true)
  if [ -n "$PID" ]; then
    echo "[e2e] Port $PORT in use by PID $PID, sending TERM..."
    kill $PID 2>/dev/null || true
    sleep 2
    STILL=$(lsof -ti:$PORT 2>/dev/null || true)
    if [ -n "$STILL" ]; then
      echo "[e2e] Still in use, sending KILL..."
      kill -9 $STILL 2>/dev/null || true
      sleep 1
    fi
  fi
else
  echo "[e2e] lsof not found, skipping port cleanup (ensure port $PORT is free)"
fi

echo "[e2e] 正在 build..."
PLAYWRIGHT_TEST_MODE=true E2E=1 PORT=$PORT pnpm build

echo "[e2e] 正在 start..."
exec env PORT=$PORT E2E=1 PLAYWRIGHT_TEST_MODE=true pnpm start
