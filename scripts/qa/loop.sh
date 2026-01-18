#!/bin/bash
set -euo pipefail

# ============================================================
# QA Loop - Automated Self-Check Pipeline
# ============================================================
# Fast, deterministic, fail-fast pipeline for CI/local dev
# Usage: pnpm qa:loop

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$PROJECT_ROOT"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Artifacts
ARTIFACTS_DIR="$PROJECT_ROOT/artifacts/qa"
SERVER_LOG="$ARTIFACTS_DIR/server.log"
SESSIONS_DIR="$PROJECT_ROOT/artifacts/agent-browser-full/sessions"

# Dev server
DEV_PORT=3000
DEV_PID=""
BASE_URL="http://127.0.0.1:$DEV_PORT"

# ============================================================
# Utilities
# ============================================================

log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[✓]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
  echo -e "${RED}[✗]${NC} $1"
}

log_step() {
  echo ""
  echo -e "${GREEN}============================================================${NC}"
  echo -e "${GREEN}$1${NC}"
  echo -e "${GREEN}============================================================${NC}"
}

cleanup() {
  log_info "Cleaning up..."
  
  if [ -n "$DEV_PID" ] && kill -0 "$DEV_PID" 2>/dev/null; then
    log_info "Stopping dev server (PID: $DEV_PID)"
    kill -TERM "$DEV_PID" 2>/dev/null || true
    sleep 2
    kill -KILL "$DEV_PID" 2>/dev/null || true
  fi
  
  # Kill any remaining processes on port 3000
  lsof -ti:$DEV_PORT 2>/dev/null | xargs kill -9 2>/dev/null || true
  
  log_success "Cleanup complete"
}

trap cleanup EXIT INT TERM

# ============================================================
# Step 1: Ensure clean state
# ============================================================

log_step "STEP 1: Ensure clean state"

# Kill any existing dev servers
log_info "Checking for existing dev servers on port $DEV_PORT..."
if lsof -ti:$DEV_PORT >/dev/null 2>&1; then
  log_warn "Found existing process on port $DEV_PORT, killing..."
  lsof -ti:$DEV_PORT | xargs kill -9 2>/dev/null || true
  sleep 1
fi
log_success "Port $DEV_PORT is free"

# Remove stale lock file
LOCK_FILE="$PROJECT_ROOT/.next/dev/lock"
if [ -f "$LOCK_FILE" ]; then
  log_warn "Removing stale lock file: $LOCK_FILE"
  rm -f "$LOCK_FILE"
fi
log_success "No stale lock files"

# Ensure artifacts directory exists
mkdir -p "$ARTIFACTS_DIR"
mkdir -p "$SESSIONS_DIR"
log_success "Artifacts directory ready: $ARTIFACTS_DIR"

# ============================================================
# Step 2: Start dev server
# ============================================================

log_step "STEP 2: Start dev server"

log_info "Starting dev server on port $DEV_PORT..."
pnpm dev > "$SERVER_LOG" 2>&1 &
DEV_PID=$!
log_info "Dev server started (PID: $DEV_PID)"

# Wait for server to be ready
log_info "Waiting for server to be ready..."
MAX_WAIT=60
ELAPSED=0

while [ $ELAPSED -lt $MAX_WAIT ]; do
  if curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/auth" 2>/dev/null | grep -q "200\|307\|302"; then
    log_success "Server is ready! (${ELAPSED}s)"
    break
  fi
  
  if ! kill -0 "$DEV_PID" 2>/dev/null; then
    log_error "Dev server died during startup!"
    log_error "Last 80 lines of server log:"
    tail -80 "$SERVER_LOG"
    exit 1
  fi
  
  sleep 1
  ELAPSED=$((ELAPSED + 1))
  
  if [ $((ELAPSED % 10)) -eq 0 ]; then
    log_info "Still waiting... (${ELAPSED}s)"
  fi
done

if [ $ELAPSED -ge $MAX_WAIT ]; then
  log_error "Server failed to start within ${MAX_WAIT}s"
  log_error "Last 80 lines of server log:"
  tail -80 "$SERVER_LOG"
  exit 1
fi

# ============================================================
# Step 3: Smoke-check blocker endpoint
# ============================================================

log_step "STEP 3: Smoke-check blocker endpoint"

TAGS_ENDPOINT="$BASE_URL/api/tags?category=content"
log_info "Testing: $TAGS_ENDPOINT"

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$TAGS_ENDPOINT" 2>/dev/null || echo "000")

# Accept 200 (success) or 401 (unauthorized - expected for unauthenticated request)
if [ "$HTTP_CODE" != "200" ] && [ "$HTTP_CODE" != "401" ]; then
  log_error "Endpoint returned HTTP $HTTP_CODE (expected 200 or 401)"
  log_error "Last 80 lines of server log:"
  tail -80 "$SERVER_LOG"
  exit 1
fi

log_success "Endpoint returned HTTP $HTTP_CODE (OK)"

# ============================================================
# Step 4: Export sessions
# ============================================================

log_step "STEP 4: Export sessions"

log_info "Note: This step requires MANUAL LOGIN in the browser"
log_info "Please login when prompted:"
log_info "  Fan: fan@test.com / TestFan123!"
log_info "  Creator: creator@test.com / TestCreator123!"
echo ""

# Export fan session
log_info "Exporting fan session..."
if ! pnpm test:session:export:fan; then
  log_error "Failed to export fan session"
  exit 1
fi

FAN_SESSION="$SESSIONS_DIR/fan.json"
if [ ! -f "$FAN_SESSION" ]; then
  log_error "Fan session file not found: $FAN_SESSION"
  exit 1
fi
log_success "Fan session exported: $FAN_SESSION"

# Export creator session
log_info "Exporting creator session..."
if ! pnpm test:session:export:creator; then
  log_error "Failed to export creator session"
  exit 1
fi

CREATOR_SESSION="$SESSIONS_DIR/creator.json"
if [ ! -f "$CREATOR_SESSION" ]; then
  log_error "Creator session file not found: $CREATOR_SESSION"
  exit 1
fi
log_success "Creator session exported: $CREATOR_SESSION"

# ============================================================
# Step 5: Run full audit
# ============================================================

log_step "STEP 5: Run full audit"

log_info "Running full site audit..."
AUDIT_OUTPUT=$(mktemp)

if ! pnpm audit:full > "$AUDIT_OUTPUT" 2>&1; then
  log_error "Full audit failed!"
  cat "$AUDIT_OUTPUT"
  rm -f "$AUDIT_OUTPUT"
  exit 1
fi

# Verify audit output contains expected markers
if ! grep -q "Testing as: FAN" "$AUDIT_OUTPUT"; then
  log_error "Audit output missing 'Testing as: FAN'"
  cat "$AUDIT_OUTPUT"
  rm -f "$AUDIT_OUTPUT"
  exit 1
fi

if ! grep -q "Testing as: CREATOR" "$AUDIT_OUTPUT"; then
  log_error "Audit output missing 'Testing as: CREATOR'"
  cat "$AUDIT_OUTPUT"
  rm -f "$AUDIT_OUTPUT"
  exit 1
fi

if grep -qi "missing session file" "$AUDIT_OUTPUT"; then
  log_error "Audit failed with missing session file error"
  cat "$AUDIT_OUTPUT"
  rm -f "$AUDIT_OUTPUT"
  exit 1
fi

log_success "Full audit completed successfully"

# Show audit summary
echo ""
log_info "Audit Summary:"
cat "$AUDIT_OUTPUT" | tail -30
rm -f "$AUDIT_OUTPUT"

# ============================================================
# Step 6: Final verification
# ============================================================

log_step "STEP 6: Final verification"

# Check generated files
log_info "Checking generated files..."

EXPECTED_FILES=(
  "$SESSIONS_DIR/fan.json"
  "$SESSIONS_DIR/creator.json"
  "$SESSIONS_DIR/fan-post-login.png"
  "$SESSIONS_DIR/creator-post-login.png"
  "$PROJECT_ROOT/artifacts/agent-browser-full/summary.json"
  "$PROJECT_ROOT/artifacts/agent-browser-full/audit-results.json"
)

MISSING_FILES=()
for file in "${EXPECTED_FILES[@]}"; do
  if [ ! -f "$file" ]; then
    MISSING_FILES+=("$file")
  fi
done

if [ ${#MISSING_FILES[@]} -gt 0 ]; then
  log_error "Missing expected files:"
  for file in "${MISSING_FILES[@]}"; do
    echo "  - $file"
  done
  exit 1
fi

log_success "All expected files present"

# List generated files
echo ""
log_info "Generated files:"
echo ""
echo "Sessions:"
ls -lh "$SESSIONS_DIR" | tail -n +2
echo ""
echo "Audit artifacts:"
ls -lh "$PROJECT_ROOT/artifacts/agent-browser-full" | grep -E "\.json$|\.png$" | head -10
echo ""

# Show summary.json
if [ -f "$PROJECT_ROOT/artifacts/agent-browser-full/summary.json" ]; then
  log_info "Audit Summary (summary.json):"
  cat "$PROJECT_ROOT/artifacts/agent-browser-full/summary.json"
  echo ""
fi

# ============================================================
# Success
# ============================================================

log_step "✅ QA LOOP COMPLETE"

log_success "All checks passed!"
log_info "Server log saved to: $SERVER_LOG"
log_info "Artifacts saved to: $ARTIFACTS_DIR"

exit 0
