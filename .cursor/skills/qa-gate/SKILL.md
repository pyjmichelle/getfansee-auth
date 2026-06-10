---
name: qa-gate
description: "Run GetFanSee's project-specific QA gate pipeline. Triggers: 'run QA gate', 'check for dead clicks', 'run qa:gate', 'check UI gate', 'run full audit', 'qa loop'. Covers gate-ui, gate-deadclick, full-site-audit scripts."
metadata:
  author: getfansee
  version: "1.0.0"
---

# QA Gate Skill

This skill runs GetFanSee's automated QA gate pipeline. It wraps the scripts in `scripts/qa/` and `scripts/full-site-audit.ts`.

## When to Use

- Before every merge/PR to verify UI correctness and eliminate dead UI
- As part of the release review workflow (pair with `release-gate` and `release-review-walkthrough`)
- When `chief-quality-officer` requests gate verification

## Command Matrix

### Quick gate (server must already be running on :3000)

```bash
pnpm qa:gate
```

This runs in sequence:

1. `bash scripts/qa/check-server.sh` — verify dev server is up
2. `pnpm test:gate:ui` → `tsx scripts/qa/gate-ui.ts` — key selector health check
3. `pnpm test:gate:deadclick` → `tsx scripts/qa/gate-deadclick.ts` — dead/unresponsive UI detection
4. `pnpm audit:full` → `tsx scripts/full-site-audit.ts` — 60+ routes × Fan + Creator roles

### Gate with auto-created sessions (CI-friendly)

```bash
pnpm qa:gate:with-sessions
```

Same as above but first runs `pnpm test:session:auto:all` to bootstrap Fan + Creator sessions automatically (requires `PLAYWRIGHT_TEST_MODE=true` and test accounts).

### Full QA loop (clean-state, requires manual logins)

```bash
pnpm qa:loop
```

Full pipeline: clean state → start dev server → smoke check → export sessions (manual login ×2) → full audit. Takes 5–10 minutes.

## Artifacts

Results land in `artifacts/`:

```
artifacts/
  qa/
    server.log           # dev server log
  agent-browser-full/
    sessions/
      fan.json           # Fan session state
      creator.json       # Creator session state
    summary.json         # audit summary
    audit-results.json   # per-route results
    *.png                # post-login screenshots
```

## Reading Results

```bash
# Check summary
cat artifacts/agent-browser-full/summary.json | jq .

# Check per-route failures
cat artifacts/agent-browser-full/audit-results.json | jq '.[] | select(.status == "fail")'
```

## Gate Success Criteria

- `gate-ui.ts` exits 0 — all key selectors present
- `gate-deadclick.ts` exits 0 — no unresponsive click targets
- `audit:full` exits 0 — no Fan/Creator route crashes; no missing session files
- `artifacts/agent-browser-full/summary.json` shows `"passRate": 1.0` (or acceptable threshold)

## Common Failures

| Symptom                                  | Fix                                                          |
| ---------------------------------------- | ------------------------------------------------------------ |
| `check-server.sh` fails                  | Start `pnpm dev` first, wait for `/api/health` 200           |
| "missing session file"                   | Run `pnpm test:session:auto:all` or manually export sessions |
| `gate-ui.ts` fails on selector           | Element missing in DOM — check route rendering               |
| `gate-deadclick.ts` reports dead buttons | Button has no handler or is hidden — check component         |
| `audit:full` 401 on protected route      | Session expired — re-export session files                    |

## Source Files

- `scripts/qa/gate-ui.ts` — UI selector gate
- `scripts/qa/gate-deadclick.ts` — dead-click detector
- `scripts/qa/loop.sh` — full QA loop script
- `scripts/qa/check-server.sh` — server health check
- `scripts/full-site-audit.ts` — 60+ route multi-role audit
- `scripts/qa/README.md` — detailed pipeline documentation
