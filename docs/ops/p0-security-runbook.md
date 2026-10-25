# P0 security rollout runbook

Keep all real-money feature flags disabled until every item below passes.

## 1. Isolate CI

Create a dedicated Supabase test project and add these repository secrets:

- `E2E_SUPABASE_URL`
- `E2E_SUPABASE_ANON_KEY`
- `E2E_SUPABASE_SERVICE_ROLE_KEY`
- `E2E_SUPABASE_PROJECT_REF`
- `E2E_TEST_USER_PASSWORD`
- `E2E_DATABASE_URL`
- `PRODUCTION_SUPABASE_PROJECT_REF`

CI fails closed if the URL and project ref differ. It also runs the read-only
database posture check before QA. Never store the E2E service-role or database
credentials in a public environment or reuse the production project for QA.

## 2. Apply database containment

Apply migrations `059` through `069` in numeric order to the E2E project first,
then production after the release gate. Migration 065 additionally requires
the maintenance window and opening-data review in `funded-earned-account-split.md`.
The follow-up migrations cover payment
intent binding, KYC/profile/moderation authorization, atomic mock recharge, and
withdrawals capped by earned liabilities. Writing these files does not deploy
them: until they are applied, the live database does not have these protections.
Use the normal migration mechanism and preserve its audit log.

The existing staging project was initialized on 2026-10-25 with a reviewed
empty-schema baseline and follow-up migrations. See `staging-validation-2026-10-25.md`
for actual state, validation and remaining credential setup. Do not replay the
historical numbered files over that initialized schema.

Run the read-only live check after each deployment:

```bash
DATABASE_URL='postgresql://...' \
DB_POSTURE_PROJECT_REF='expected-project-ref' \
pnpm check:db-posture
```

## 3. Remove test pollution

Preview only (default):

```bash
TARGET_SUPABASE_PROJECT_REF='expected-project-ref' \
pnpm cleanup:test-users
```

The script only recognises strict test-email patterns. It blocks deletion when
any financial record exists or a financial-reference check fails.

After reviewing the preview, a production deletion requires both an explicit
flag and an exact project-ref confirmation:

```bash
TARGET_SUPABASE_PROJECT_REF='expected-project-ref' \
CONFIRM_TEST_DATA_PURGE='expected-project-ref' \
pnpm cleanup:test-users -- --apply --allow-production
```

Accounts with financial history must be archived/anonymised through a reviewed
workflow; do not weaken the foreign keys or manually cascade-delete the ledger.

## 4. Contain previously committed sessions

Delete or ban the exposed test accounts and revoke their sessions in Supabase.
Treat any copied browser storage state as compromised. If a privileged project
key was ever committed, rotate that key separately. Repository history cleanup
requires a coordinated history rewrite after temporarily restricting access.

## 5. Release gate

Merge only after CI passes against the dedicated E2E project and the live
database posture check succeeds. Real-money flags remain disabled until the
payment provider, reconciliation, refund, tax, KYC and payout operating paths
have owners and have passed a small-value controlled rehearsal.

## 6. Deferred backend work and validation limits

Complete the code review and local checks before changing hosted configuration.
Then provision the dedicated test project/secrets, apply the migrations there,
and run authenticated multi-user E2E, RLS and concurrent payment/withdrawal tests.
Offline SQL checks validate migration logic on a minimal PostgreSQL-compatible
schema; they do not prove the complete deployed schema or multi-connection locks.

Migration 064 contains shared-wallet risks conservatively. Migration 065
replaces that containment with funded-only wallets and ledger-only earnings;
it refuses unreconciled or ambiguous historical opening data. Until 065 is
applied and validated, the hosted system still has the shared account model.
Its code and offline tests alone are not a completed historical migration.

Revoke previously exposed sessions and review storage policies and old signed
media URLs: removing URLs from current responses cannot revoke an existing URL.
Verify production identity variables (`VERCEL_ENV`/`APP_ENV`), geography, age/KYC
callbacks, payment webhook authenticity/replay, settlement/refund schedules and
ledger reconciliation on the isolated project before enabling real payments.
