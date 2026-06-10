---
name: creator-ambassador-referral
description: "Source of truth for GetFanSee's Creator Ambassador Referral Program. Triggers: 'ambassador', 'referral', 'referral code', 'commission', 'creator referral', 'ambassador program', '推荐计划', '推荐码'. Use when implementing, reviewing, or debugging the referral/ambassador feature."
metadata:
  author: getfansee
  version: "1.0.0"
---

# Creator Ambassador Referral Program Skill

This skill is the source of truth for GetFanSee's Creator-to-Creator referral program ("Ambassador Program"). The full PRD + technical design lives in:

**`docs/planning/creator-ambassador-referral-program.md`** (1081 lines) — read this before any implementation.

## Feature Overview

- **Who**: Verified creators only (requires `profiles.role = 'creator'` + KYC approved)
- **What**: Each creator gets a unique referral code; sharing it earns commission when a new creator signs up and hits milestones
- **MVP scope**: Track commissions as internal pending records only — not withdrawable (no payout RPC in MVP)
- **DB**: Migration `042_creator_ambassador_program.sql`

## Key Files

### API Routes (Route Handlers)

```
app/api/referral/
  enroll/route.ts       — Creator enrolls in ambassador program (generates referral code)
  me/route.ts           — Get current creator's ambassador stats
  me/referrals/route.ts — List creators referred by current user
app/r/[code]/route.ts   — Referral code landing redirect (sets cookie, redirects to /auth)
```

### Business Logic

```
lib/ambassador/
  bind.ts               — Bind referral cookie to user after signup (idempotent)
  server.ts             — Server-side ambassador queries and mutations
  types.ts              — TypeScript types for ambassador/referral entities
lib/referral.ts         — Shared referral utilities
```

### UI

```
app/creator/studio/ambassador/page.tsx  — Ambassador dashboard (Studio tab)
```

### Database

```
migrations/042_creator_ambassador_program.sql  — Tables, RLS, triggers
```

### PRD

```
docs/planning/creator-ambassador-referral-program.md  — Full design (1081 lines)
```

## Supabase Client Conventions (use existing helpers — DO NOT invent new ones)

| Context            | Helper                            | Import                          |
| ------------------ | --------------------------------- | ------------------------------- |
| Browser/Client     | `getSupabaseBrowserClient()`      | `lib/supabase-browser.ts`       |
| Server (RSC)       | `getSupabaseServerClient`         | `lib/server/supabase-server.ts` |
| Route Handler      | `getSupabaseRouteHandlerClient()` | `lib/server/supabase-route.ts`  |
| Admin (bypass RLS) | `getSupabaseAdminClient()`        | `lib/server/supabase-admin.ts`  |

## Auth/AuthZ Primitives (reuse — DO NOT re-implement)

```typescript
// Check auth in Route Handlers
import { withAuth } from "lib/server/route-handler";
import { requireVerifiedCreator } from "lib/authz";
import { getCurrentUser } from "lib/server/auth-server";
```

## Referral Code Flow

```
1. Creator enrolls → POST /api/referral/enroll → generates unique code, stores in DB
2. Creator shares URL: https://getfansee.com/r/<code>
3. Visitor hits app/r/[code]/route.ts → sets referral cookie → redirects to /auth
4. After signup/login, lib/ambassador/bind.ts reads cookie → binds referral → cookie cleared
5. Commission accrues when referred creator hits milestone (e.g. first paid post)
```

## Security Constraints

- Referral cookie binding must be **idempotent** (double-bind safe)
- No **self-referral** allowed (`bind.ts` must check referrer !== referee)
- Cookie must be **HttpOnly** to prevent XSS theft
- Commission records are **internal only** in MVP — no withdrawal endpoint

## Migration 042 Key Tables

The migration at `migrations/042_creator_ambassador_program.sql` creates:

- `ambassador_enrollments` — which creators are enrolled + their referral code
- `referral_events` — tracks each referral click/bind event
- `ambassador_commissions` — pending commission records (not withdrawable in MVP)

All tables have RLS. Review RLS policies with `chief-security-architect` before shipping.

## Required Agent Reviews

| Domain                  | Agent                                |
| ----------------------- | ------------------------------------ |
| DB schema / RLS         | `chief-backend-platform-architect`   |
| UI / Studio page        | `chief-frontend-architect`           |
| Commission / wallet     | `chief-payments-risk-officer`        |
| Cookie security         | `chief-security-architect`           |
| Terms / disclosure      | `chief-legal-compliance-advisor`     |
| Referral funnel metrics | `chief-data-experimentation-officer` |

## Testing

```bash
# Type-check and lint
pnpm check-all

# Integration: referral API tests (if they exist)
pnpm vitest run tests/integration/api/referral.test.ts

# E2E: ambassador studio page
pnpm exec playwright test tests/e2e/ambassador.spec.ts --project=chromium
```
