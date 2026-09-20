#!/usr/bin/env bash

set -euo pipefail

# Local `next build` and Playwright builds remain valid. Hosted production
# builds must fail if any test bypass can be compiled or enabled.
if [ "${VERCEL_ENV:-}" != "production" ] \
  && [ "${DEPLOYMENT_ENV:-}" != "production" ] \
  && [ "${APP_ENV:-}" != "production" ]; then
  exit 0
fi

fail=0
for name in NEXT_PUBLIC_TEST_MODE PLAYWRIGHT_TEST_MODE E2E E2E_ALLOW_ANY_HOST; do
  value="${!name:-}"
  if [ -n "$value" ] && [ "$value" != "0" ] && [ "$value" != "false" ] && [ "$value" != "False" ]; then
    echo "ERROR: $name must not be enabled in production."
    fail=1
  fi
done

exit "$fail"
