#!/usr/bin/env bash
# Staging 安全门禁：禁止在 staging 环境开启 test-mode，防止 service_role + /api/test/* 暴露。
# 在部署流程中调用；若检测到 test-mode env 被开启则 exit 1。
# 用法: bash scripts/ci/assert-no-test-mode-on-staging.sh

set -e

FAIL=0

check() {
  local name="$1"
  local val="${!name}"
  if [ -n "$val" ] && [ "$val" != "0" ] && [ "$val" != "false" ] && [ "$val" != "False" ]; then
    echo "❌ STAGING SAFETY: $name is set (value=$val). Test-mode must NOT be enabled on staging."
    FAIL=1
  fi
}

check "NEXT_PUBLIC_TEST_MODE"
check "PLAYWRIGHT_TEST_MODE"
check "E2E"

if [ "$FAIL" -eq 1 ]; then
  echo ""
  echo "Unset these variables in your staging environment (e.g. Vercel / Railway env)."
  exit 1
fi

echo "✅ Staging safety: no test-mode env enabled."
exit 0
