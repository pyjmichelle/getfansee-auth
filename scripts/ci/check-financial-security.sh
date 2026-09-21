#!/usr/bin/env bash

set -euo pipefail

migration="migrations/059_financial_security_lockdown.sql"
history_migration="migrations/060_preserve_financial_history.sql"

test -f "$migration" || { echo "ERROR: financial security migration is missing"; exit 1; }
test -f "$history_migration" || { echo "ERROR: financial history migration is missing"; exit 1; }

if rg -n 'priceCents\?:' app/api/unlock/route.ts >/dev/null; then
  echo "ERROR: /api/unlock must not accept a client-supplied price"
  exit 1
fi

rg -q 'DROP POLICY IF EXISTS "wallet_accounts_update_own"' "$migration" || {
  echo "ERROR: wallet self-update policy is not revoked"
  exit 1
}

rg -q "p\.proname = ANY" "$migration" || {
  echo "ERROR: financial RPC privilege lockdown is missing"
  exit 1
}

rg -q "posts\.price_cents" "$migration" || {
  echo "ERROR: PPV RPC does not derive its price from the post row"
  exit 1
}

rg -q "ON DELETE RESTRICT" "$history_migration" || {
  echo "ERROR: financial records are still vulnerable to cascading account deletion"
  exit 1
}

rg -q "E2E_SUPABASE_SERVICE_ROLE_KEY" .github/workflows/ci.yml || {
  echo "ERROR: CI service role is not isolated to E2E-specific secrets"
  exit 1
}

if rg -n "SUPABASE_SERVICE_ROLE_KEY:.*secrets\.SUPABASE_SERVICE_ROLE_KEY" .github/workflows/ci.yml >/dev/null; then
  echo "ERROR: CI still maps the generic service-role secret into a test job"
  exit 1
fi

echo "OK: financial security invariants are present"
