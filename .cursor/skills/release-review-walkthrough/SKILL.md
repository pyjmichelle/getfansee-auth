---
name: release-review-walkthrough
description: "Conduct a structured UI/UX release review walkthrough for GetFanSee. Triggers: 'run release review', 'do a walkthrough', 'demo release review', 'QA walkthrough', '发布走查', '全站走查'. Produces: qa-notes + release review report following the project's F-001 issue numbering template."
metadata:
  author: getfansee
  version: "1.0.0"
---

# Release Review Walkthrough Skill

This skill produces a structured release review report following GetFanSee's established template from `docs/reports/ui-walkthrough-20260420-demo-release-review.md`. Use the `cursor-ide-browser` MCP to navigate pages and capture evidence.

## When to Use

- Before every demo or major release
- When `chief-quality-officer` requests walkthrough evidence
- As a companion to `qa-gate` (automated) — this adds human-style visual + UX verification
- For regression comparison against a prior walkthrough report

## Report Structure (Required Output)

Save output to `docs/reports/ui-walkthrough-<YYYYMMDD>-<label>.md`.

```markdown
# UI Walkthrough — <Date> — <Label>

## Preflight

- [ ] Dev server running at localhost:3000
- [ ] Fan session: artifacts/agent-browser-full/sessions/fan.json
- [ ] Creator session: artifacts/agent-browser-full/sessions/creator.json

## Scope

- Roles: Guest, Fan, Creator
- Viewports: PC (1280px), Mobile (375px)
- Priority: P0 (auth, paywall, wallet) → P1 (studio, ambassador) → P2 (legal, admin)

## Issue Log (F-XXX format)

| ID    | Severity | Route           | Description | Evidence        |
| ----- | -------- | --------------- | ----------- | --------------- |
| F-001 | P0       | /auth           | ...         | screenshot path |
| F-002 | P1       | /creator/studio | ...         | screenshot path |

## Route Coverage

### Guest

- [ ] / (root redirect)
- [ ] /auth (login page)
- [ ] /home (public feed)

### Fan (authenticated)

- [ ] /home
- [ ] /me/wallet
- [ ] /me (profile)
- [ ] /posts/[id] (free, subscriber, PPV)
- [ ] /notifications
- [ ] /purchases

### Creator (authenticated)

- [ ] /creator/studio (dashboard)
- [ ] /creator/studio/ambassador (推荐计划 — NEW)
- [ ] /creator/upgrade (if not yet creator)
- [ ] Post creation flow

### Legal / Compliance

- [ ] /2257
- [ ] /privacy
- [ ] /dmca
- [ ] /about
- [ ] /acceptable-use

## Release Decision Gate

| Check               | Status                              |
| ------------------- | ----------------------------------- |
| P0 issues           | None / Listed                       |
| P1 issues           | None / Listed                       |
| Regression vs prior | New / Fixed / Same                  |
| Recommendation      | PASS / PASS WITH CONDITIONS / BLOCK |

## New vs Prior Report Regression

Compare with: `docs/reports/ui-walkthrough-<PRIOR DATE>-<label>.md`

| Issue | Status in prior | Status now         |
| ----- | --------------- | ------------------ |
| F-001 | Open            | Fixed / Still open |
```

## Walkthrough Workflow

### Step 1: Preflight

```bash
# Verify server is up
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health

# Check sessions exist
ls artifacts/agent-browser-full/sessions/
```

### Step 2: Navigate Using Browser MCP

Use `cursor-ide-browser` MCP tools to navigate each route:

- `browser_navigate` → load URL
- `browser_snapshot` → inspect ARIA tree for issues
- `browser_take_screenshot` → capture visual evidence
- Save screenshots to `docs/reports/screenshots/<date>/`

### Step 3: Issue Numbering

Number issues sequentially as `F-001`, `F-002`, etc. Include:

- **Severity**: P0 (blocker), P1 (high), P2 (cosmetic)
- **Route**: exact path
- **Description**: what is wrong (not "might be")
- **Evidence**: screenshot path or DOM observation

### Step 4: Regression Comparison

Find the most recent prior report:

```bash
ls -t docs/reports/ui-walkthrough-*.md | head -3
```

Mark each prior open issue as: Fixed ✅ / Still Open 🔴 / Changed ⚠️

### Step 5: Release Decision

- **PASS**: No P0 issues, P1 issues tracked in backlog
- **PASS WITH CONDITIONS**: Minor P1s with mitigation plan
- **BLOCK**: Any P0 issue unresolved

## Source Templates

- `docs/reports/ui-walkthrough-20260420-demo-release-review.md` — Master template
- `docs/reports/_qa-20260420-notes.md` — Issue log format reference
- `docs/reports/ui-regression-20260421-demo-rerun.md` — Regression comparison format
- `docs/agents/DESIGN_QA_AGENT_AND_SKILLS.md` — Agent/skill coordination for Design QA
