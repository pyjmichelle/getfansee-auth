---
description: RELEASE GATE - Supreme Law for Repair, Verification, CI Readiness, and Production Consistency.
scope: GLOBAL
priority: ABSOLUTE
version: 1.0.0
---

# 🚨 RELEASE GATE SUPREME LAW (v1.0)

This document is the **highest authority** in this repository.
All rules, agents, skills, scripts, and fixes MUST comply.

Violation = REFUSE TO PROCEED.

---

## 0. PRIME DIRECTIVE (不可违背)

🎯 **唯一目标**：

> The codebase MUST be pushable to CI with **100% pass**, and behave **identically** in:

- Local dev
- CI
- Production (Vercel)

If this cannot be proven → STOP.

---

## 1. PLAN OR REFUSE (取代 sprint 文档缺失)

If no planning doc exists:

- The agent MUST generate a **temporary execution plan**
- Save it to:

docs/planning/\_auto/<timestamp>-release-plan.md

Plan MUST include:

- Scope
- Affected files
- Tests to run
- CI checks involved

❌ No plan → No code.

---

## 2. MULTI-AGENT MANDATORY PIPELINE

Every repair / refactor / CI fix MUST dispatch agents **in this order**:

### Stage 1 — SYSTEM SCAN

Agents:

- `chief-ai-automation`
- `chief-reliability`
- `chief-quality`

Goals:

- Detect hidden failures
- Detect CI mismatch
- Detect flakiness risks

---

### Stage 2 — DOMAIN OWNERSHIP

Dispatch **by problem type**:

| Problem             | Agent                    |
| ------------------- | ------------------------ |
| Auth / Supabase     | `chief-backend-platform` |
| UI / test selectors | `chief-frontend`         |
| E2E failures        | `chief-quality`          |
| CI / env / ports    | `chief-reliability`      |
| Payments / wallet   | `chief-payments-risk`    |
| Legal / DMCA / KYC  | `chief-legal-compliance` |
| Abuse / safety      | `chief-trust-safety`     |

❌ Skipping the correct agent = INVALID FIX.

---

### Stage 3 — SKILLS ENFORCEMENT (MANDATORY)

Agents MUST actively use relevant skills from:

.cursor/skills/

Minimum required skills per category:

#### Auth / Identity

- `better-auth-best-practices.skill.md`
- `supabase-postgres.skill.md`

#### UI / Frontend

- `shadcn-ui.skill.md`
- `react-best-practices.skill.md`
- `frontend-design.skill.md`

#### E2E / QA

- `e2e-test-setup.skill.md`
- `fixture-generator.skill.md`
- `test-report-generator.skill.md`

#### CI / Infra

- `ci-pipeline-config.skill.md`
- `api-test-runner.skill.md`

❌ Fixes that ignore skills are considered **hallucinated**.

---

## 3. ZERO-HALLUCINATION RULE

The agent MUST NOT:

- Guess Supabase schemas
- Guess Stripe behavior
- Guess browser auth state
- Guess Playwright selectors

Instead:

- Use skills
- Use Browser tool
- Use existing code as source of truth

Unverified assumptions = HARD STOP.

---

## 4. TEST OR IT DID NOT HAPPEN

Every fix MUST include **real output**.

### Mandatory Evidence

At least one of:

```bash
pnpm type-check
pnpm lint
pnpm build
pnpm exec playwright test tests/e2e/smoke-check.spec.ts
pnpm qa:gate
```

Logs MUST be pasted or summarized with:

Passed / Failed count

Duration

Environment

❌ “Should work” is forbidden language.

5. CI EQUIVALENCE LAW
   Local behavior MUST match CI behavior.
   Required guarantees:

Same PORT (3000)

Same env loading strategy

Same build command

Same auth/session model

If CI fails but local passes → LOCAL IS WRONG.

6. RELEASE BLOCKERS (ABSOLUTE)
   The following block push / merge:

❌ pnpm build fails

❌ Auth works in script but fails in UI (or vice versa)

❌ E2E relies on brittle selectors without testids

❌ Session works in CI but not locally

❌ “Temporarily skip” without explicit approval

7. FIX CLASSIFICATION (必须声明)
   Every change MUST be tagged as one:

P0 — CI / Build / Auth / Money

P1 — UX / Flakiness / Test stability

P2 — Refactor / Cleanup

P3 — Docs / Comments

P0 fixes require:

Agent confirmation

Test proof

CI impact explanation

8. ARTIFACTS & TRACEABILITY
   Every repair MUST leave traces:

Debug logs → debug.log

Reports → docs/reports/

Legacy failures → docs/archive/legacy_reports/

Silent fixes are forbidden.

9. VERSIONING & FUTURE UPGRADE
   This law is versioned.
   Upgrade process:

Copy this file

Increment version

Add CHANGELOG section

Never break backward rules without justification

10. FINAL GATE — CAN WE PUSH?
    Before saying “ready” the agent MUST answer:

✅ Can this be pushed now?

✅ Will CI pass without manual intervention?

✅ Is local == CI == prod?

✅ Are all relevant agents & skills used?

If ANY answer is “not sure” → STOP.

🧠 Remember:
Speed is optional.
Correctness is mandatory.

---
