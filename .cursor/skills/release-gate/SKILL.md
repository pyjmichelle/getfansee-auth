---
name: release-gate
description: "Run the full pre-merge release gate sequence for GetFanSee. Triggers: 'is this ready to merge?', 'run release gate', 'pre-merge check', 'can I push?', '发布门禁', '合并前检查'. Enforces: check-all → build → qa:gate → playwright chromium."
metadata:
  author: getfansee
  version: "1.0.0"
---

# Release Gate Skill

This skill enforces the **mandatory pre-merge release gate** for GetFanSee. It wraps `.cursor/release-gate.prompt.md` into an executable workflow with concrete commands.

## Mandatory Gate Sequence

Run these commands **in order**. All must pass before merging.

```bash
# Step 1: Type-check, lint, format, security checks
pnpm check-all

# Step 2: Production build
pnpm build

# Step 3: QA gate (server must be running — start pnpm dev first)
pnpm qa:gate

# Step 4: E2E smoke (or full chromium suite for P0 changes)
pnpm test:e2e:smoke
# Full suite for P0/auth/payments:
pnpm exec playwright test --project=chromium
```

## Pre-Push Shortcut (Husky)

The pre-push hook runs a lighter version:

```bash
SKIP_QA_GATE=1 pnpm ci:verify
```

This skips QA Gate and E2E (those run in CI). It still covers: `check:env` → `lint` → `type-check` → `build`.

## What check-all Covers

`pnpm check-all` runs 5 steps:

1. `type-check` — TypeScript strict mode
2. `lint` — ESLint (zero warnings policy)
3. `format:check` — Prettier
4. `check:service-role` — `scripts/ci/check-no-service-role-leaks.sh`
5. `check:admin-client` — `scripts/ci/check-admin-client-allowlist.sh`

It does **NOT** include `test:unit` or `build` — those are separate steps.

## Agent Dispatch

Before calling this skill, ensure the correct chief agent has reviewed the change:

| Change type          | Required agent                     |
| -------------------- | ---------------------------------- |
| Auth / Supabase / DB | `chief-backend-platform-architect` |
| UI / routes          | `chief-frontend-architect`         |
| Payments / wallet    | `chief-payments-risk-officer`      |
| Security / RLS       | `chief-security-architect`         |
| Legal / KYC          | `chief-legal-compliance-advisor`   |
| E2E / CI             | `chief-quality-officer`            |

## Required Skills Per Category

Load these skills when reviewing the corresponding domain:

**Auth/Identity**: `supabase` (official skill), `supabase-postgres-best-practices`
**UI/Frontend**: `shadcn-ui`, `react-best-practices`, `frontend-design`
**E2E/QA**: `e2e-test-setup`, `fixture-generator`, `test-report-generator`
**CI/Infra**: `ci-pipeline-config`, `api-test-runner`

## Release Blockers (ABSOLUTE)

The following block push / merge — fix before proceeding:

- `pnpm build` fails
- Auth works in script but fails in UI (or vice versa)
- E2E relies on brittle selectors without testids
- Session works in CI but not locally
- `pnpm check-all` has any error or unexpected warning

## Evidence Required

Every "ready to merge" claim must include:

- Passing `pnpm check-all` output
- Passing `pnpm build` output (or CI link)
- `qa:gate` pass or scoped `test:e2e:smoke` pass
- Fix classification tag: P0/P1/P2/P3

## Source Files

- `.cursor/release-gate.prompt.md` — Supreme law document
- `scripts/ci/verify.sh` — `pnpm ci:verify` implementation
- `.github/workflows/ci.yml` — CI pipeline (stages 1–5)
- `docs/reports/prelaunch-gate-automation-recommendations-20260228.md` — Historical gate design notes
