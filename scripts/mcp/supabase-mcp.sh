#!/usr/bin/env bash
# Launch Supabase MCP — token MUST live in .env.local only (never in mcp.json or code).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="$ROOT/.env.local"

if [ -z "${SUPABASE_PERSONAL_ACCESS_TOKEN:-}" ] && [ -f "$ENV_FILE" ]; then
  SUPABASE_PERSONAL_ACCESS_TOKEN="$(
    grep -E '^SUPABASE_PERSONAL_ACCESS_TOKEN=' "$ENV_FILE" | tail -1 | cut -d= -f2- | sed 's/^["'\'' ]//; s/["'\'' ]$//' | tr -d '\r'
  )"
  export SUPABASE_PERSONAL_ACCESS_TOKEN
fi

if [ -z "${SUPABASE_PERSONAL_ACCESS_TOKEN:-}" ]; then
  echo "SUPABASE_PERSONAL_ACCESS_TOKEN is not set. Add it to .env.local (never commit)." >&2
  exit 1
fi

exec npx -y @supabase/mcp-server-supabase@latest --access-token "$SUPABASE_PERSONAL_ACCESS_TOKEN" --read-only
