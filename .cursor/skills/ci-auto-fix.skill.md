---
description: CI Auto-Fix Skill - Automatically analyze and fix CI failures
globs: ["**/.github/workflows/**", "**/playwright.config.*", "**/package.json", "**/tsconfig.json"]
alwaysApply: false
---

# CI Auto-Fix Skill

## Purpose

This skill enables AI agents to automatically analyze GitHub CI failures, identify root causes, and generate or apply fixes. It supports integration with Reviewdog, GitHub Copilot, and custom self-healing CI patterns.

## When to Use

Use this skill when:

- CI pipeline fails and you need to understand why
- You want to automatically fix common CI issues
- You need to analyze CI logs and generate fix suggestions
- You want to implement self-healing CI capabilities

## Core Capabilities

### 1. CI Failure Analysis

**Analyze GitHub Actions workflow failures**:

- Read workflow run logs
- Identify failure stage (lint, build, test, deploy)
- Classify error type (code, config, dependency, infrastructure, transient)
- Extract actionable error messages

**Example Analysis**:

```typescript
// Common failure patterns
- Build failures: TypeScript errors, missing dependencies, network issues
- Test failures: Flaky tests, timeout, environment issues
- Lint failures: ESLint errors, Prettier format issues
- Infrastructure: Resource limits, network timeouts, missing secrets
```

### 2. Automatic Fix Generation

**Generate fixes for common issues**:

#### TypeScript Errors

- Missing type definitions
- Incorrect type annotations
- Import path issues

#### ESLint Errors

- Auto-fixable rules (run `pnpm lint:fix`)
- Manual fixes with code suggestions

#### Build Failures

- Missing environment variables
- Dependency conflicts
- Network issues (fonts, external resources)

#### Test Failures

- Flaky test detection
- Timeout adjustments
- Environment configuration

### 3. Self-Healing Patterns

**Implement automatic retry and fix**:

```yaml
# Example: Auto-retry transient errors
- name: Build with retry
  uses: nick-fields/retry@v3
  with:
    timeout_minutes: 10
    max_attempts: 3
    retry_wait_seconds: 5
    command: pnpm build
```

**Known issue patterns**:

- Google Fonts network failure → Use fallback fonts
- Disk space errors → Clean workspace
- Dependency conflicts → Use `--legacy-peer-deps`
- Port conflicts → Use dynamic port allocation

## Implementation Guide

### Step 1: Analyze CI Failure

```bash
# Read GitHub Actions logs
gh run view <run-id> --log

# Or analyze local test failures
pnpm check-all
pnpm build
pnpm exec playwright test --project=chromium
```

### Step 2: Classify Failure Type

**Code Issues**:

- TypeScript errors → Fix types
- ESLint errors → Run `pnpm lint:fix` or manual fix
- Missing imports → Add imports

**Configuration Issues**:

- Missing environment variables → Add to GitHub Secrets
- Incorrect config files → Fix config
- Missing dependencies → Update package.json

**Infrastructure Issues**:

- Network timeouts → Add retry logic
- Resource limits → Optimize or upgrade
- Port conflicts → Use dynamic ports

**Transient Issues**:

- Network failures → Retry with backoff
- Race conditions → Add synchronization
- Flaky tests → Increase timeout or fix test

### Step 3: Generate Fix

**For code issues**:

1. Read the error message
2. Locate the problematic file
3. Apply the fix (type annotation, import, etc.)
4. Verify with `pnpm type-check` or `pnpm lint`

**For config issues**:

1. Identify missing/incorrect config
2. Update config file
3. Verify with relevant check command

**For infrastructure issues**:

1. Add retry logic or fallback
2. Update CI workflow if needed
3. Test locally with `CI=true`

### Step 4: Verify Fix

```bash
# Run the same command that failed in CI
pnpm check-all
pnpm build
pnpm qa:gate
pnpm exec playwright test --project=chromium
```

## Common Fix Patterns

### Pattern 1: Google Fonts Network Failure

**Problem**: `Failed to fetch 'Inter' from Google Fonts`

**Fix**:

```typescript
// app/layout.tsx
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  fallback: ["system-ui", "-apple-system", "sans-serif"],
  display: "swap",
  // Skip font download in CI/test mode
  ...(process.env.CI === "true" || process.env.PLAYWRIGHT_TEST_MODE === "true"
    ? { preload: false }
    : {}),
});
```

**Verification**:

```bash
CI=true PLAYWRIGHT_TEST_MODE=true pnpm build
```

### Pattern 2: ESLint Errors

**Problem**: ESLint reports errors

**Fix**:

```bash
# Auto-fix what can be fixed
pnpm lint:fix

# Manual fix for remaining errors
# Read error message, locate file, apply fix
```

### Pattern 3: TypeScript Errors

**Problem**: Type errors in code

**Fix**:

1. Read error message
2. Add type annotations
3. Fix import paths
4. Update type definitions

**Verification**:

```bash
pnpm type-check
```

### Pattern 4: Playwright Test Failures

**Problem**: Tests fail in CI but pass locally

**Fix**:

1. Check for flaky selectors → Add `testid` attributes
2. Check for timing issues → Increase timeout
3. Check for environment differences → Ensure CI env matches local
4. Check for network issues → Add retry logic

**Verification**:

```bash
CI=true pnpm exec playwright test --project=chromium
```

### Pattern 5: Build Failures

**Problem**: `pnpm build` fails

**Common causes**:

- Missing environment variables → Add to CI secrets
- Type errors → Fix types
- Missing dependencies → Run `pnpm install`
- Network issues → Add retry or fallback

**Verification**:

```bash
CI=true pnpm build
```

## Integration with Reviewdog

### Setup Reviewdog in GitHub Actions

```yaml
# .github/workflows/code-quality.yml
- name: Run Reviewdog (ESLint)
  uses: reviewdog/action-eslint@v1
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    reporter: github-pr-review
    eslint_flags: "."
    fail_on_error: false
    filter_mode: added
```

### Using Reviewdog Output

Reviewdog comments on PRs with:

- File path and line number
- Error message
- Suggestion for fix

**Agent should**:

1. Read Reviewdog comments
2. Apply suggested fixes
3. Verify fix with `pnpm lint`
4. Commit and push

## Integration with Self-Healing CI

### Create Self-Healing Workflow

```yaml
# .github/workflows/self-healing-ci.yml
name: Self-Healing CI

on:
  workflow_run:
    workflows: ["CI Pipeline"]
    types: [completed]

jobs:
  analyze-and-fix:
    if: failure()
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Analyze failure
        id: analyze
        uses: actions/github-script@v7
        with:
          script: |
            // Get failed workflow run
            const run = await github.rest.actions.getWorkflowRun({
              owner: context.repo.owner,
              repo: context.repo.repo,
              run_id: context.payload.workflow_run.id
            });

            // Get logs and analyze
            // Classify failure type
            // Generate fix suggestion

      - name: Apply fix (if applicable)
        if: steps.analyze.outputs.fixable == 'true'
        run: |
          # Apply automatic fix
          # e.g., pnpm lint:fix, update config, etc.

      - name: Create fix PR
        if: steps.analyze.outputs.fixable == 'true'
        uses: peter-evans/create-pull-request@v5
        with:
          title: "Auto-fix: ${{ steps.analyze.outputs.issue }}"
          body: "Automatically fixed: ${{ steps.analyze.outputs.description }}"
```

## Agent Workflow

### When CI Fails

1. **Read CI logs**:

   ```bash
   gh run view <run-id> --log > ci-failure.log
   ```

2. **Analyze failure**:
   - Identify failed job
   - Extract error message
   - Classify error type

3. **Generate fix**:
   - For code issues: Fix code
   - For config issues: Update config
   - For transient issues: Add retry/fallback

4. **Verify fix**:
   - Run same command locally
   - Ensure it passes

5. **Commit and push**:
   - Commit fix
   - Push to trigger CI again
   - Monitor CI run

### When Reviewdog Comments

1. **Read Reviewdog comments** on PR
2. **Apply fixes** for each comment
3. **Verify** with `pnpm lint` or `pnpm type-check`
4. **Commit and push**

## Best Practices

### 1. Always Verify Locally

Before pushing fixes:

```bash
# Run the exact same commands as CI
CI=true pnpm check-all
CI=true pnpm build
CI=true pnpm exec playwright test --project=chromium
```

### 2. Understand Root Cause

Don't just fix symptoms:

- Read error messages carefully
- Check related files
- Understand why it failed

### 3. Test Fixes

After applying fix:

- Run relevant check command
- Ensure no regressions
- Check related functionality

### 4. Document Fixes

For complex fixes:

- Add comments explaining the fix
- Update documentation if needed
- Note any trade-offs

### 5. Handle Transient Errors

For known transient issues:

- Add retry logic
- Use fallback mechanisms
- Don't mask real problems

## Examples

### Example 1: Fix Google Fonts Issue

**Error**: `Failed to fetch 'Inter' from Google Fonts`

**Analysis**:

- Network dependency in CI
- Font loading fails during build
- Blocks Playwright webServer

**Fix**:

```typescript
// Add fallback and CI handling
const inter = Inter({
  subsets: ["latin"],
  fallback: ["system-ui", "-apple-system", "sans-serif"],
  display: "swap",
  ...(process.env.CI === "true" ? { preload: false } : {}),
});
```

**Verification**:

```bash
CI=true pnpm build  # Should pass
```

### Example 2: Fix ESLint Error

**Error**: `'any' type is not allowed`

**Analysis**:

- TypeScript strict mode
- Need explicit type

**Fix**:

```typescript
// Before
function process(data: any) { ... }

// After
function process(data: unknown) {
  if (typeof data === 'string') {
    // Handle string
  }
  // ...
}
```

**Verification**:

```bash
pnpm lint
pnpm type-check
```

## Related Skills

- `ci-pipeline-config.skill.md` - CI pipeline configuration
- `e2e-test-setup.skill.md` - E2E test setup and debugging
- `api-test-runner.skill.md` - API testing

## References

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Reviewdog Documentation](https://github.com/reviewdog/reviewdog)
- [Self-Healing CI Patterns](https://smartscope.blog/en/ai-development/github-actions-self-healing-workflows-2025/)
- [Next.js Font Optimization](https://nextjs.org/docs/app/building-your-application/optimizing/fonts)
