# E2E Testing Guide (CI-First Strategy)

## Overview

We use a **CI-First** E2E testing strategy. GitHub Actions (ubuntu-latest) is the source of truth for E2E test results. Local macOS testing is supported but may encounter Crashpad/sandbox issues on ARM64.

## Running E2E Tests

### In CI (Automatic)

Tests run automatically on:

- Push to `main` or `develop`
- Pull requests to `main` or `develop`

CI uses **production build** (`pnpm start`) with Playwright's bundled Chromium.

### Locally (Development)

```bash
# Run with dev server (default, Chromium only)
pnpm exec playwright test --project=chromium

# Run all browsers
PW_ALL_BROWSERS=true pnpm exec playwright test

# Run specific test file
pnpm exec playwright test tests/e2e/smoke.spec.ts

# Run with UI mode (interactive)
pnpm exec playwright test --ui

# List all tests without running
pnpm exec playwright test --list
```

### Docker Fallback (Recommended for macOS ARM64)

If you encounter Crashpad/sandbox errors on macOS:

```bash
# Add to package.json scripts:
# "e2e:docker": "docker run --rm -it --ipc=host -v $(pwd):/work -w /work mcr.microsoft.com/playwright:v1.57.0-noble /bin/bash -c 'npm ci && npx playwright test --project=chromium'"

# Run:
pnpm e2e:docker
```

## Downloading CI Artifacts

When CI fails, download artifacts from GitHub Actions:

1. Go to the failed workflow run
2. Scroll to "Artifacts" section
3. Download:
   - `playwright-report` - HTML report with screenshots
   - `playwright-traces` - Trace files for debugging

### Viewing Traces Locally

```bash
# After downloading playwright-traces.zip
unzip playwright-traces.zip
pnpm exec playwright show-trace test-results/*/trace.zip
```

## Configuration

### playwright.config.ts Key Settings

| Setting               | CI           | Local      |
| --------------------- | ------------ | ---------- |
| `headless`            | `true`       | `false`    |
| `retries`             | `1`          | `0`        |
| `webServer.command`   | `pnpm start` | `pnpm dev` |
| `reuseExistingServer` | `false`      | `true`     |

### Environment Variables

| Variable              | Description                                          |
| --------------------- | ---------------------------------------------------- |
| `CI`                  | Set automatically in GitHub Actions                  |
| `PW_ALL_BROWSERS`     | Set to `true` to run Firefox + WebKit                |
| `PLAYWRIGHT_BASE_URL` | Override base URL (default: `http://127.0.0.1:3000`) |
| `PORT`                | Server port (default: `3000`)                        |

## Common Errors & Fixes

### 1. `ENOENT .next` / `Could not find a production build`

**Cause**: `.next/` directory missing when running `pnpm start`

**Fix**:

```bash
pnpm build
pnpm exec playwright test
```

### 2. `No tests found`

**Cause**: Wrong `testDir` or test files not matching pattern

**Fix**: Check `playwright.config.ts`:

```typescript
testDir: "./tests/e2e"; // Must match your test location
```

### 3. `missing env` / `NEXT_PUBLIC_SUPABASE_URL is not defined`

**Cause**: Environment variables not set

**Fix**:

```bash
# Local: Create .env.local
cp .env.example .env.local

# CI: Add secrets in GitHub repo settings
# Settings → Secrets and variables → Actions
```

### 4. `browserType.launch: Executable doesn't exist` (macOS ARM64)

**Cause**: Playwright browser architecture mismatch

**Fix**: Use Docker fallback:

```bash
pnpm e2e:docker
```

Or reinstall browsers:

```bash
rm -rf ~/Library/Caches/ms-playwright
pnpm exec playwright install --with-deps chromium
```

### 5. `Crashpad permission error` / `Operation not permitted`

**Cause**: macOS sandbox restrictions on headless Chrome

**Fix**:

- Use Docker fallback
- Or run headed: set `headless: false` in config

### 6. `Timeout waiting for server`

**Cause**: Server failed to start or wrong port

**Fix**:

```bash
# Check if port is in use
lsof -i :3000

# Kill existing process
kill -9 $(lsof -t -i:3000)

# Verify server starts manually
pnpm dev  # or pnpm start (after build)
```

## Test Structure

```
tests/e2e/
├── smoke.spec.ts          # Basic health checks
├── smoke-check.spec.ts    # System health
├── stable-tests.spec.ts   # Core functionality
├── fan-journey.spec.ts    # Fan user flows
├── creator-journey.spec.ts # Creator user flows
├── money-flow.spec.ts     # Payment/wallet tests
├── paywall-flow.spec.ts   # Subscription/PPV tests
├── complete-journey.spec.ts # Full user journeys
├── edge-cases.spec.ts     # Error handling
└── sprint4-mvp.spec.ts    # MVP monetization
```

## CI Workflow Summary

```
lint-and-type-check → build → e2e-tests (chromium)
                           ↘ legacy-tests (optional)
                                    ↓
                              quality-gate
```

## Quick Reference

| Task              | Command                                        |
| ----------------- | ---------------------------------------------- |
| Run all tests     | `pnpm exec playwright test`                    |
| Run chromium only | `pnpm exec playwright test --project=chromium` |
| Run with UI       | `pnpm exec playwright test --ui`               |
| List tests        | `pnpm exec playwright test --list`             |
| View report       | `pnpm exec playwright show-report`             |
| View trace        | `pnpm exec playwright show-trace <trace.zip>`  |
| Docker run        | `pnpm e2e:docker`                              |
