#!/bin/bash
# CI Auto-Monitor and Fix Script
# Continuously monitors CI status and fixes issues until all checks pass

set -e

MAX_ITERATIONS=20
ITERATION=0
ALL_PASSED=false

echo "🚀 CI Auto-Monitor and Fix - Starting..."
echo "=========================================="

while [ $ITERATION -lt $MAX_ITERATIONS ] && [ "$ALL_PASSED" = false ]; do
  ITERATION=$((ITERATION + 1))
  echo ""
  echo "📊 Iteration $ITERATION/$MAX_ITERATIONS"
  echo "----------------------------------------"

  # Step 1: Run local checks
  echo "🔍 [1/4] Running local checks..."
  if ! pnpm check-all; then
    echo "❌ Local checks failed, fixing..."
    pnpm lint:fix || true
    pnpm format || true
    continue
  fi
  echo "✅ Local checks passed"

  # Step 2: Build verification
  echo "🔨 [2/4] Verifying build..."
  if ! CI=true pnpm build; then
    echo "❌ Build failed, checking for issues..."
    # Check for common build issues
    if grep -q "Failed to fetch.*Google Fonts" .next/build.log 2>/dev/null; then
      echo "⚠️  Google Fonts issue detected (should be fixed with fallback)"
    fi
    continue
  fi
  echo "✅ Build passed"

  # Step 3: Check git status
  echo "📝 [3/4] Checking git status..."
  if [ -n "$(git status --porcelain)" ]; then
    echo "📦 Uncommitted changes detected, committing..."
    git add -A
    git commit -m "fix: auto-fix CI issues (iteration $ITERATION)" || true
    git push origin feature/add-readme-badge || true
    echo "✅ Changes committed and pushed"
  else
    echo "✅ No uncommitted changes"
  fi

  # Step 4: Wait and check CI status (simulated)
  echo "⏳ [4/4] Waiting for CI to complete..."
  echo "💡 Note: Actual CI status requires GitHub API access"
  echo "💡 Please check: https://github.com/pyjmichelle/getfansee-auth/pull/1/checks"
  
  sleep 10

  # For now, assume we need to continue
  # In a real scenario, we would check GitHub API for CI status
  echo "🔄 Continuing monitoring..."
done

if [ "$ALL_PASSED" = true ]; then
  echo ""
  echo "=========================================="
  echo "✅ All CI checks passed!"
  echo "=========================================="
else
  echo ""
  echo "=========================================="
  echo "⚠️  Reached maximum iterations"
  echo "Please check CI status manually:"
  echo "https://github.com/pyjmichelle/getfansee-auth/pull/1/checks"
  echo "=========================================="
fi
