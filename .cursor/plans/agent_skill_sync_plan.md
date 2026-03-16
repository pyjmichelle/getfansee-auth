# Task: Agent/Skill Sync Refresh

## Goal

Update quality agent and skill guide to match current project routes, migrations, and QA gate commands.

## Phases

- [x] Phase 1: Baseline audit of current agent/skill files and project scripts/routes
- [x] Phase 2: Update agent and reference docs
- [x] Phase 3: Add persistent sync rule for future project updates

## Current Status

**Phase:** Complete  
**Progress:** 3/3 steps complete  
**Blockers:** None

## Decisions Made

- Add explicit project coverage and command matrix to chief-quality docs.
- Add mandatory sync trigger rule under `.cursor/rules/`.
- Keep verification scope as docs-level (`pnpm check-all` advised).

## Error Log

- None.

## Notes

- This task is P2 docs/governance and does not change runtime logic.
