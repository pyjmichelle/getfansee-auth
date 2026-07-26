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
  "app/api/cron/financial-audit/route.ts"
  "app/api/report/route.ts"
  # support: public ticket insert (anonymous + logged-in), bypass RLS
  "app/api/support/route.ts"
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
  # creator application: insert into creator_applications (or profiles metadata fallback)
  "app/api/creator/apply/route.ts"
  # creator: creator profile creation (auth-gated, 401 if not signed in)
  "app/api/creator/create/route.ts"
  # tips: server-side wallet debit/credit + tips insert (auth-gated, 401)
  "app/api/tip/route.ts"
  # tips: creator manages own tip settings (auth-gated, RLS bypass for own row)
  "app/api/creator/tip-settings/route.ts"
  # tips: public read of creator tip panel (read-only RLS bypass; only opt-in display_name/avatar, no PII)
  "app/api/creator/[id]/tip-settings/route.ts"
  # ambassador: admin commission review (requireAdmin)
  "app/api/admin/commissions/route.ts"
  "app/api/admin/commissions/[id]/approve/route.ts"
  "app/api/admin/commissions/[id]/reject/route.ts"
  # ambassador: admin referral attribution management (requireAdmin)
  "app/api/admin/referrals/route.ts"
  "app/api/admin/referrals/[id]/fraud/route.ts"
  # ambassador: admin program settings (requireAdmin)
  "app/api/admin/referral-settings/route.ts"
  # alpha: admin review of creator external links (requireAdmin)
  "app/api/admin/creator-links/route.ts"
  "app/api/admin/creator-links/[id]/route.ts"
  # alpha: public outbound redirect for APPROVED links only; increments click_count (no PII)
  "app/api/link/out/route.ts"
  # alpha: email capture double opt-in; newsletter_subscribers is server-only by design (no RLS policies)
  "app/api/newsletter/subscribe/route.ts"
  "app/api/newsletter/confirm/route.ts"
  # alpha: public follower counts need RLS bypass (aggregate only; auth-gated writes)
  "app/api/follow/route.ts"
  # alpha: public directory follower/post counts (aggregates only, no row data returned)
  "app/api/creators/directory/route.ts"
  # alpha: Home sidebar suggested-creators, same aggregate-only RPC as the directory route
  "app/api/creators/suggested/route.ts"
  # alpha: profile view counter increment via service-role-only RPC (aggregate, no PII)
  "app/api/creators/[id]/view/route.ts"
  # alpha: creator studio analytics aggregates (requireCreator; numbers only)
  "app/api/creator/analytics/route.ts"
  # crypto side quest: NowPayments IPN webhook (signature-verified, server-side wallet credit)
  "app/api/webhooks/nowpayments/route.ts"
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
