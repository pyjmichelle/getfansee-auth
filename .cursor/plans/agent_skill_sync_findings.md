# Findings: Agent/Skill Sync Refresh

## Research Summary

- `chief-quality` and `docs/agents/04-chief-quality` were generic and stale.
- Project has evolved with new auth flows, admin routes, and migrations `032`-`035`.
- Existing skills guide lacked explicit maintenance triggers and current topology references.

## Code Analysis

- `package.json` already contains extensive QA commands (`check-all`, `qa:gate`, `test:auth:*`, `test:e2e:*`).
- `app/` includes new route groups: admin, notifications, ai-dashboard, and auth reset flows.
- `tests/e2e/` now includes `auth-mock`, `auth-real`, `design-qa`.

## Technical Notes

- Added a new global rule to reduce documentation drift:
  - `.cursor/rules/agent-skill-sync.mdc`
