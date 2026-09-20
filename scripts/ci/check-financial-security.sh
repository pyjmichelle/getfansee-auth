#!/usr/bin/env bash

set -euo pipefail

migration="migrations/059_financial_security_lockdown.sql"

test -f "$migration" || { echo "ERROR: financial security migration is missing"; exit 1; }

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

echo "OK: financial security invariants are present"
