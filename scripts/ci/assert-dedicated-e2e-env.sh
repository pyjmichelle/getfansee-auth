#!/usr/bin/env bash

set -euo pipefail

required=(
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  SUPABASE_SERVICE_ROLE_KEY
  E2E_SUPABASE_PROJECT_REF
  E2E_TEST_USER_PASSWORD
  PRODUCTION_SUPABASE_PROJECT_REF
)

for name in "${required[@]}"; do
  if [ -z "${!name:-}" ]; then
    echo "ERROR: $name is required for CI E2E. Configure the E2E_* GitHub secrets."
    exit 1
  fi
done

actual_ref="$(printf '%s' "$NEXT_PUBLIC_SUPABASE_URL" | sed -E 's#^https?://([^.]+)\.supabase\.co.*#\1#')"
if [ "$actual_ref" = "$NEXT_PUBLIC_SUPABASE_URL" ] || [ "$actual_ref" != "$E2E_SUPABASE_PROJECT_REF" ]; then
  echo "ERROR: E2E Supabase URL does not match E2E_SUPABASE_PROJECT_REF."
  exit 1
fi

if [ "$PRODUCTION_SUPABASE_PROJECT_REF" = "$actual_ref" ]; then
  echo "ERROR: E2E project ref matches PRODUCTION_SUPABASE_PROJECT_REF."
  exit 1
fi

echo "OK: CI is pinned to the dedicated E2E Supabase project."
