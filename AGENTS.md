# GetFanSee — Agent Dispatch Guide

This file is the canonical agent name reference for GetFanSee. It resolves inconsistencies between
agent file names, `name:` frontmatter fields, and short names used in rules/release-gate.

All agent definitions live in [`.cursor/agents/`](.cursor/agents/). Mirror docs in [`docs/agents/`](docs/agents/).

---

## Agent Dispatch Table

| Problem Domain                         | Canonical `name:` (use this)         | File                                           | Docs Mirror                                    |
| -------------------------------------- | ------------------------------------ | ---------------------------------------------- | ---------------------------------------------- |
| UI / routes / hydration / UX           | `chief-frontend-architect`           | `.cursor/agents/chief-frontend.md`             | `docs/agents/02-chief-frontend.md`             |
| API / DB / Supabase / RLS / backend    | `chief-backend-platform-architect`   | `.cursor/agents/chief-backend-platform.md`     | `docs/agents/03-chief-backend-platform.md`     |
| Tests / CI / Playwright / QA gate      | `chief-quality-officer`              | `.cursor/agents/chief-quality.md`              | `docs/agents/04-chief-quality.md`              |
| CI / env / ports / infra / reliability | `chief-reliability-architect`        | `.cursor/agents/chief-reliability.md`          | `docs/agents/05-chief-reliability.md`          |
| Payments / wallet / Stripe / billing   | `chief-payments-risk-officer`        | `.cursor/agents/chief-payments-risk.md`        | `docs/agents/06-chief-payments-risk.md`        |
| Product / MVP scope / roadmap          | `chief-product-architect`            | `.cursor/agents/chief-product.md`              | `docs/agents/07-chief-product.md`              |
| Metrics / experiments / analytics      | `chief-data-experimentation-officer` | `.cursor/agents/chief-data-experimentation.md` | `docs/agents/08-chief-data-experimentation.md` |
| Legal / compliance / KYC / DMCA        | `chief-legal-compliance-advisor`     | `.cursor/agents/chief-legal-compliance.md`     | `docs/agents/09-chief-legal-compliance.md`     |
| Security / auth / RLS / threats        | `chief-security-architect`           | `.cursor/agents/chief-security.md`             | `docs/agents/10-chief-security.md`             |
| Content moderation / abuse / safety    | `chief-trust-safety-officer`         | `.cursor/agents/chief-trust-safety.md`         | `docs/agents/11-chief-trust-safety.md`         |
| AI / automation / kill switch          | `chief-ai-automation-architect`      | `.cursor/agents/chief-ai-automation.md`        | `docs/agents/12-chief-ai-automation.md`        |
| Per-file security review (sub-agent)   | `security-reviewer`                  | `.cursor/agents/security-reviewer.md`          | —                                              |

> The `name:` value in frontmatter is the canonical identifier. Short names like `chief-frontend`
> (without `-architect`) are **deprecated** — they appeared in older rules and should be updated
> to the full canonical name.

---

## Project Context (2026-06-07)

**Stack**: Next.js 16 + React 19 + Supabase + Stripe + Didit KYC + Playwright + Vitest

**Active business domains**:

- Auth (`app/auth/*`, `lib/server/auth-server.ts`)
- Content / Feed (`app/home/`, `app/posts/`)
- Creator Studio (`app/creator/studio/`)
- Ambassador / Referral Program — NEW (`app/creator/studio/ambassador/`, `app/api/referral/*`, `app/r/[code]/`)
- Wallet / Payments (`app/me/wallet/`, `app/api/wallet/`, Stripe webhooks)
- KYC (`lib/kyc/kyc-service.ts`, `app/api/kyc/`)
- Legal pages (`app/2257/`, `app/privacy/`, `app/dmca/`, `app/about/`, `app/acceptable-use/`)
- Admin (`app/admin/*`)

**Latest migration**: `042_creator_ambassador_program.sql`

---

## Release Gate Agent Pipeline

For repair / refactor / pre-merge, dispatch agents in this order:

1. **Stage 1 — System Scan**: `chief-ai-automation-architect`, `chief-reliability-architect`, `chief-quality-officer`
2. **Stage 2 — Domain Fix**: dispatch by problem type (see table above)
3. **Stage 3 — Skills Enforcement**: agents must load relevant skills from `.cursor/skills/`

---

## Key Skills Index

| Skill                              | Trigger                                                  |
| ---------------------------------- | -------------------------------------------------------- |
| `supabase`                         | Any Supabase Auth / DB / RLS / SSR work                  |
| `supabase-postgres-best-practices` | Schema design, query optimization, RLS                   |
| `next-best-practices`              | Next.js 16 App Router patterns                           |
| `creator-ambassador-referral`      | Ambassador / referral program feature                    |
| `qa-gate`                          | QA gate pipeline (gate-ui + gate-deadclick + audit:full) |
| `release-gate`                     | Pre-merge gate sequence                                  |
| `release-review-walkthrough`       | Structured UI release review                             |
| `code-check`                       | Run `pnpm check-all`                                     |
| `find-skills`                      | Discover new skills via `npx skills find`                |

Full index: [`.cursor/skills/SKILLS_APPLICATION_GUIDE.md`](.cursor/skills/SKILLS_APPLICATION_GUIDE.md)

---

## Supabase MCP

Configured in [`.cursor/mcp.json`](.cursor/mcp.json). Set `SUPABASE_PERSONAL_ACCESS_TOKEN` in your
environment to enable. Allows agent to query live schema, RLS policies, and run read-only SQL.

```bash
# Example: generate TypeScript types from DB schema via MCP
supabase gen types typescript --linked
```
