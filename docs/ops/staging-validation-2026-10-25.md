# Staging repair and validation — 2026-10-25

## Confirmed environments

| Resource                 | Verified target                                              |
| ------------------------ | ------------------------------------------------------------ |
| Supabase test project    | `getfansee-staging`, ref `cwrvrqstueecsssqwdys`              |
| Existing active database | ref `ordomkygjpujxyivwviq`; read-only inspection only        |
| Vercel application       | `getfansee-auth`, project `prj_Ab5K9EinWZAACmUjeNiElvzdTh7m` |
| Vercel root site         | `getfansee`, project `prj_wVbilkT0QGIJ99jvdCNvcLlmaIBQ`      |
| Authorized team          | `pyj-michelles-projects`                                     |
| Isolated preview branch  | `codex/p0-security-lockdown`                                 |

Both existing preview configurations pointed at the active database. Added
branch-specific Preview overrides to both Vercel projects: staging URL and
public anon key, test mode off, APP_ENV=staging, both real-payment flags off,
and an empty service-role override. This prevents inheriting an active-database
service credential; the owner must supply the staging credential before server
admin operations can work. Production variables and deployments were not changed.

## Database work completed

Restored the paused test project and verified it had no application tables,
auth users or stored objects. Applied the reviewed empty-schema bootstrap
through066, then067,068 and069. The test database now has47 application tables,
all with RLS. Its financial-security posture check passes.

`scripts/ops/empty-schema-bootstrap.json` specifies the reviewed ordering;
`build-empty-schema-bootstrap.mjs` assembles it without accessing a database.
Its SQL guard refuses any pre-existing application tables, auth users or stored
objects. Historical compatibility changes retain only001's profile base,
select clean/safe replacements, and correct034's renamed subscription index
column. It is not a production upgrade installer. Do not rerun on this populated
schema or replace migration history with individual old files.

Forward repairs:

- 066 restores the subscription-price column and admin role constraint that
  existed manually in the active database but were missing from repository
  history. It appends the public username to the existing safe creator view,
  matching the search endpoint without exposing email or KYC fields.
- 067 fixes PostgreSQL global function defaults: a schema-only PUBLIC revoke
  cannot override global default EXECUTE. It checks the application function
  owner, hardens that owner's defaults, and leaves managed owners untouched.
  Posture checks now inspect that owner and include global/schema inherited grants.
- 068 closes browser execution of internal trigger callbacks and retention jobs
  and fixes mutable search paths; public creator-directory lookup remains public.
- 069 removes legacy creator-wide raw-profile read policies that exposed creator
  email to anonymous users. Raw profiles are owner-only; public pricing/labels
  use safe projections. Search/tag author queries and comments/subscribers were
  rewired accordingly. The insert guard now handles optional historical KYC
  columns safely, preserving normal signup. Comments require the parent post's
  entitlement and the caller's own author ID.

## Validation completed

The full migration plan passes local PostgreSQL-compatible regression checks:
all application tables and policies come from repository migrations; only
Supabase-managed auth/storage primitives are emulated. The native PostgreSQL CI
job also runs the full-schema suite. Its result must be inspected for this head.

On the actual hosted staging database, transaction-scoped checks passed for:

- funding a test spending wallet and purchasing a subscription at the database
  price rather than the supplied amount;
- paid subscriber content access, owner profile editing and public creator lookup;
- denial of cross-user wallet reads, browser admin promotion, KYC approval,
  wallet balance edits and subscription extension;
- denial of anonymous creator-email reads, nonowner raw-profile reads, unpaid
  comment reads and comment-author forgery, while preserving signup/profile edits;
- funded/earned isolation and all financial reconciliation identities.

All generated test identities, posts, balances and transactions were rolled
back. Verified auth-user, consumption-order and transaction counts are zero.
These checks exercise the hosted database, not full browser/API/provider E2E.

Supabase advisor findings remain for deliberately server-only RLS tables,
owner-filtered public-safe views and the intended public creator-count RPC.
Do not weaken policies or change view semantics merely to silence those notices.

## Owner configuration still required

Current connectors cannot write GitHub repository Secrets or retrieve a new
staging server credential. No production key was copied to staging.

1. In Supabase, open the **test** project and obtain its server-side service-role
   credential. Enter it directly in each Vercel project's `SUPABASE_SERVICE_ROLE_KEY`
   override for Preview branch `codex/p0-security-lockdown`. Never select Production.
2. In GitHub repository Settings → Secrets and variables → Actions, add:

| Secret                            | Value/source                                     |
| --------------------------------- | ------------------------------------------------ |
| `E2E_SUPABASE_URL`                | `https://cwrvrqstueecsssqwdys.supabase.co`       |
| `E2E_SUPABASE_ANON_KEY`           | Test project's public anon key                   |
| `E2E_SUPABASE_PROJECT_REF`        | `cwrvrqstueecsssqwdys`                           |
| `PRODUCTION_SUPABASE_PROJECT_REF` | `ordomkygjpujxyivwviq`                           |
| `E2E_SUPABASE_SERVICE_ROLE_KEY`   | Test project's service-role credential           |
| `E2E_DATABASE_URL`                | Test project's PostgreSQL connection string      |
| `E2E_TEST_USER_PASSWORD`          | A generated password used only for test fixtures |

After configuration, rebuild the isolated previews and rerun the blocked QA/E2E
jobs. Then validate OAuth, age/KYC/provider callbacks, settlement/refunds and
operational payout flows. Keep PR29 draft and real-money flags disabled until
the release gate passes. Historical production reconciliation and migrations,
production deployment and new admin features have not been performed.
