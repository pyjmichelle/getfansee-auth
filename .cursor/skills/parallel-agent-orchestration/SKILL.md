---
name: parallel-agent-orchestration
description: Coordinate multiple agents editing this repo in parallel without overwriting each other. Use when running tasks in parallel, spawning file-editing subagents, doing a best-of-N run, or when one agent's edits got reverted by another. Pairs with the always-on rule .cursor/rules/parallel-agent-coordination.mdc and the ownership hook.
disable-model-invocation: true
---

# Parallel Agent Orchestration

The lead agent decomposes work into **disjoint file domains**, runs each in an
**isolated worktree**, then **merges + verifies**. Isolation prevents file
collisions; disjoint ownership prevents semantic clobbering.

## Workflow

```
[ ] 1. Plan: list every file/dir each task will touch
[ ] 2. Detect overlap → overlapping files become SERIAL (do not parallelize them)
[ ] 3. Assign disjoint ownership (ui / auth / infra — see the rule's map)
[ ] 4. Isolate: one worktree (or cloud VM) + branch per task
[ ] 5. (optional) Enforce: enable .cursor/agent-locks.json + export CURSOR_AGENT_OWNER
[ ] 6. Dispatch agents in parallel
[ ] 7. Merge branches in dependency order
[ ] 8. Verify: pnpm type-check && pnpm build  → reconcile any regression
```

## Step 1–3: Decompose with disjoint ownership

Read `.cursor/rules/parallel-agent-coordination.mdc` for the ownership map. The
rule is non-negotiable. Output a table before dispatching:

| Task              | Owner | Files (claim globs)                                        | Depends on |
| ----------------- | ----- | ---------------------------------------------------------- | ---------- |
| Restyle tip UI    | ui    | `components/tip-modal.tsx`, `components/support-block.tsx` | —          |
| Fix tip auth/data | auth  | `app/api/tip/**`, `lib/**`                                 | —          |

If any two rows share a file, merge them into one serial task.

## Step 4: Isolate (do not share a checkout)

- Editor: `/worktree` for a single isolated run, `/best-of-n` for N parallel attempts, `/apply-worktree` to land the chosen result.
- Or dispatch the `best-of-n-runner` subagent (own branch + worktree).
- `.cursor/worktrees.json` auto-runs install + copies `.env*` into each worktree.

## Step 5 (optional): Hard enforcement

In `.cursor/agent-locks.json`: set `enforce: true`, add `active: true` claims with
disjoint globs, and have each agent run `export CURSOR_AGENT_OWNER=<label>`. The
`preToolUse` hook then denies any cross-owner Write/Delete. Leave `enforce:false`
for solo work — it blocks nothing.

## Step 7–8: Merge then verify

Merge in dependency order. Worktrees give a clean file merge but can still
produce a broken build, so ALWAYS finish with `pnpm type-check && pnpm build`
and reconcile regressions before reporting done. Inspect
`.cursor/agent-edit-log.ndjson` to see who touched what.
