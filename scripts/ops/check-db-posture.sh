#!/usr/bin/env bash

set -euo pipefail

if ! command -v psql >/dev/null 2>&1; then
  echo "ERROR: psql is required."
  exit 1
fi

if [ -z "${DATABASE_URL:-}" ] || [ -z "${DB_POSTURE_PROJECT_REF:-}" ]; then
  echo "ERROR: set DATABASE_URL and DB_POSTURE_PROJECT_REF."
  exit 1
fi

if [[ "$DATABASE_URL" != *"$DB_POSTURE_PROJECT_REF"* ]]; then
  echo "ERROR: DATABASE_URL does not contain DB_POSTURE_PROJECT_REF; refusing to connect."
  exit 1
fi

psql "$DATABASE_URL" \
  --no-psqlrc \
  --set=ON_ERROR_STOP=1 \
  --file=scripts/ops/verify-financial-security.sql
