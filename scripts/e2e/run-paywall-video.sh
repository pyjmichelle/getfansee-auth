#!/usr/bin/env bash
# Run paywall-flow "上传视频" E2E test. Requires server already running (e.g. start-server.sh in another terminal).
# Mac/Linux compatible. Health check retries up to 60s (30 × 2s).

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

BASE_URL="${PLAYWRIGHT_BASE_URL:-http://127.0.0.1:3000}"

# Wait for server up to 60s (30 × 2s)
MAX_RETRIES=30
RETRY=0
while [ $RETRY -lt $MAX_RETRIES ]; do
  if curl -sf "$BASE_URL/api/health" >/dev/null 2>&1; then
    break
  fi
  RETRY=$((RETRY + 1))
  if [ $RETRY -eq $MAX_RETRIES ]; then
    echo "Error: Server not responding at $BASE_URL/api/health after ${MAX_RETRIES} attempts (60s)"
    echo "Start the server first (e.g. in another terminal):"
    echo "  bash scripts/e2e/start-server.sh"
    exit 1
  fi
  sleep 2
done

export E2E=1
export PLAYWRIGHT_TEST_MODE=true
export PLAYWRIGHT_SKIP_SERVER=1
export PLAYWRIGHT_BASE_URL="$BASE_URL"

exec pnpm exec playwright test tests/e2e/paywall-flow.spec.ts --project=chromium -g "上传视频" --reporter=line
