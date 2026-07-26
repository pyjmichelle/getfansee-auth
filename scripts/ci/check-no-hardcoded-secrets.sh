#!/bin/bash
#
# CI gate: block committed real secret values (Supabase personal access
# tokens, Supabase JWTs). Deliberately does NOT allowlist docs/ or scripts/ —
# a 2026-07-26 incident had a real SUPABASE_SERVICE_ROLE_KEY committed in
# markdown docs and a walkthrough script, both exempt from the
# check-no-service-role-leaks.sh variable-name scan.
#
# Secrets belong in .env.local / GitHub Secrets only — never in repo files.
#
set -e

if ! command -v rg &>/dev/null; then
  echo "ripgrep (rg) required"
  exit 1
fi

EXCLUDES=(--glob '!.env*' --glob '!node_modules/**' --glob '!.next/**' --glob '!pnpm-lock.yaml')

echo "Checking for hardcoded Supabase personal access tokens (sbp_*)..."
TOKEN_LEAKS="$(rg -n 'sbp_[a-f0-9]{20,}' "${EXCLUDES[@]}" . 2>/dev/null || true)"

echo "Checking for hardcoded Supabase project JWTs (service_role/anon)..."
# Matches the fixed header+iss-claim prefix of every real Supabase JWT:
# base64("{"alg":"HS256","typ":"JWT"}").base64("{"iss":"supabase"...).
JWT_LEAKS="$(rg -n 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.eyJpc3MiOiJzdXBhYmFzZSI[A-Za-z0-9_-]{30,}' "${EXCLUDES[@]}" . 2>/dev/null || true)"

LEAKS="$TOKEN_LEAKS
$JWT_LEAKS"
LEAKS="$(echo "$LEAKS" | sed '/^$/d')"

if [ -n "$LEAKS" ]; then
  echo ""
  echo "ERROR: Real secret value(s) found committed outside .env files:"
  echo "$LEAKS"
  echo ""
  echo "Remove the value, use a placeholder instead, and rotate the secret in Supabase Dashboard."
  exit 1
fi

echo "OK: no hardcoded Supabase tokens/JWTs in tracked source"
