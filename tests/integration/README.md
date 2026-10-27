# Database/API integration coverage

These suites are disabled unless `RUN_DATABASE_INTEGRATION_TESTS=true`.
Before any test executes, the environment must pass the dedicated Supabase
project and local API-target checks. `E2E_SUPABASE_PROJECT_REF` must match the
HTTPS Supabase URL; `PRODUCTION_SUPABASE_PROJECT_REF` must be present and different.
The local server must use that same dedicated project, with `E2E=1`.
Run `RUN_DATABASE_INTEGRATION_TESTS=true pnpm vitest run tests/integration`.

The current tests only verify unauthenticated API rejection; they do not create
users, write balances, or delete financial history. The previous integration
suites were removed because they called nonexistent wallet routes, passed Bearer
headers to cookie-session handlers, expected obsolete response shapes, and deleted
financial records directly. Those assertions were not valid release evidence.

Positive payment/creator behavior remains covered by unit seams and the existing
isolated Playwright suites, but has not been verified against a database here.
Before release, validate migrations 059/060 and RPC ACLs, own/cross-user RLS,
server-authoritative prices, duplicate PPV/subscription requests, insufficient funds,
webhook duplicate delivery, refunds, withdrawals and a complete settlement cycle.
Do not count mocked RPC results as database transactional proof. Fixtures with
financial history must be preserved, or reset only in a disposable dedicated DB.
