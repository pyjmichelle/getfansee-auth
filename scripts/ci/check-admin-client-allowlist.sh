#!/bin/bash

set -euo pipefail

echo "Checking admin client usage allowlist..."

if command -v rg >/dev/null 2>&1; then
  matches="$(rg --files-with-matches "getSupabaseAdminClient\\(" "app/api" --glob "**/*.ts" || true)"
else
  matches="$(
    grep -R -l --include="*.ts" "getSupabaseAdminClient(" "app/api" 2>/dev/null \
      | sed 's#^\./##' \
      || true
  )"
fi

if [ -z "$matches" ]; then
  echo "OK: no admin client usage under app/api"
  exit 0
fi

allowed=(
  "app/api/admin/content-review/route.ts"
  "app/api/admin/kyc/route.ts"
  "app/api/admin/reports/route.ts"
  "app/api/auth/session/route.ts"
  "app/api/cron/financial-audit/route.ts"
  "app/api/report/route.ts"
  "app/api/wallet/recharge/route.ts"
  "app/api/webhooks/didit/route.ts"
  # compliance: age gate audit logging (non-PII, server-side only)
  "app/api/age-verify/route.ts"
  # compliance: KYC document submission (private storage bucket)
  "app/api/kyc/submit/route.ts"
  # transactional emails: fetch profile/creator name for receipt emails (read-only)
  "app/api/subscribe/route.ts"
  "app/api/unlock/route.ts"
  # posts: admin client used for RLS bypass on creator post management
  "app/api/posts/[id]/route.ts"
  # payments: create Stripe checkout session, needs user profile lookup
  "app/api/payments/create-checkout-session/route.ts"
  # payments: Stripe webhook handler, processes payment events server-side
  "app/api/webhooks/stripe/route.ts"
  # subscriptions: cancel/list subscriptions, needs admin bypass for RLS
  "app/api/subscriptions/route.ts"
)

is_allowed() {
  local file="$1"
  for a in "${allowed[@]}"; do
    if [ "$file" = "$a" ]; then
      return 0
    fi
  done
  return 1
}

violations=""
while IFS= read -r file; do
  [ -z "$file" ] && continue
  if ! is_allowed "$file"; then
    violations="$violations$file
"
  fi
done <<EOF
$matches
EOF

if [ -n "$violations" ]; then
  echo "ERROR: admin client used outside allowlist:"
  printf "%s" "$violations" | while IFS= read -r file; do
    [ -n "$file" ] && echo "  - $file"
  done
  exit 1
fi

echo "OK: admin client usage is allowlisted"
