# Planning with Files Skill

> **Work like Manus** — the AI agent company Meta acquired for **$2 billion**.

## Core Principle

```
Context Window = RAM (volatile, limited)
Filesystem = Disk (persistent, unlimited)

→ Anything important gets written to disk.
```

## The 3-File Pattern

For every complex task, create THREE files:

```
.cursor/plans/[task]_plan.md    → Track phases and progress
.cursor/plans/[task]_findings.md → Store research and findings
.cursor/plans/[task]_progress.md → Session log and test results
```

## When to Use

**Use this pattern for:**

- Multi-step tasks (3+ steps)
- Research tasks
- Building/creating projects
- Tasks spanning many tool calls

**Skip for:**

- Simple questions
- Single-file edits
- Quick lookups

## Key Rules

### 1. Create Plan First

Never start complex work without creating `[task]_plan.md` first.

### 2. The 2-Action Rule

Save findings after every 2 view/browser operations:

- Read 2 files → Update findings.md
- Browse 2 pages → Update findings.md

### 3. Log ALL Errors

Track every failure in the plan file:

```markdown
## Error Log

- [timestamp] Error: [description]
- Cause: [root cause]
- Fix: [solution applied]
```

### 4. Never Repeat Failures

Before attempting something:

1. Check error log
2. If similar attempt failed, mutate approach
3. Track attempt count

### 5. Re-read Plan Before Major Decisions

Before:

- Creating new files
- Making architectural decisions
- Running tests
- Committing code

Always re-read the plan to stay aligned with goals.

## Plan File Template

```markdown
# Task: [Task Name]

## Goal

[Clear statement of what we're trying to achieve]

## Phases

- [ ] Phase 1: [Description]
- [ ] Phase 2: [Description]
- [ ] Phase 3: [Description]

## Current Status

**Phase:** [Current phase]
**Progress:** [X/Y steps complete]
**Blockers:** [Any blockers]

## Decisions Made

- [Decision 1]: [Rationale]
- [Decision 2]: [Rationale]

## Error Log

[Track all errors and their resolutions]

## Notes

[Any important context or findings]
```

## Findings File Template

```markdown
# Findings: [Task Name]

## Research Summary

[Key findings from research]

## Code Analysis

[Important code patterns discovered]

## External Resources

- [Link 1]: [Summary]
- [Link 2]: [Summary]

## Technical Notes

[Implementation details to remember]
```

## Progress File Template

```markdown
# Progress Log: [Task Name]

## Session: [Date]

### Completed

- [x] [Task 1]
- [x] [Task 2]

### In Progress

- [ ] [Task 3]

### Test Results

| Test     | Status  | Notes    |
| -------- | ------- | -------- |
| [Test 1] | ✅ Pass |          |
| [Test 2] | ❌ Fail | [Reason] |

### Next Steps

1. [Next step 1]
2. [Next step 2]
```

## The Manus Principles

| Principle               | Implementation                   |
| ----------------------- | -------------------------------- |
| Filesystem as memory    | Store in files, not context      |
| Attention manipulation  | Re-read plan before decisions    |
| Error persistence       | Log failures in plan file        |
| Goal tracking           | Checkboxes show progress         |
| Completion verification | Check all phases before stopping |

## Hooks

### PreToolUse Hook

Before major tool calls (Write, Edit, Shell):

1. Re-read current plan
2. Verify action aligns with goals
3. Check error log for similar failures

### PostToolUse Hook

After file writes:

1. Update progress in plan
2. Mark completed items
3. Note any errors

### Stop Hook

Before ending session:

1. Verify all phases complete
2. Update final status
3. Document any remaining work

## Session Recovery

When starting a new session:

1. Check for existing plan files
2. Read current status
3. Resume from last checkpoint
4. Sync any untracked progress

---

**Source:** [OthmanAdi/planning-with-files](https://github.com/OthmanAdi/planning-with-files)
**License:** MIT
