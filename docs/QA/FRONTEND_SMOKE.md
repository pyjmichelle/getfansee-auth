# Frontend Smoke Testing with agent-browser

## Overview

This document describes the **exploratory frontend smoke testing** setup using `agent-browser`. This is **NOT** a replacement for Playwright E2E tests, but rather a complementary tool for quick visual and structural validation.

### Purpose

- **Quick smoke checks** on key frontend routes
- **Visual validation** via screenshots
- **DOM structure inspection** via JSON snapshots
- **Error detection** (console errors, network failures, page errors)
- **Best-effort interaction discovery** (finds buttons like "Continue", "Submit", etc.)

### Not for

- ❌ Full end-to-end user flows (use Playwright E2E instead)
- ❌ CI/CD gating (Playwright E2E is the primary gate)
- ❌ Automated regression testing (use Playwright E2E)
- ❌ Performance testing

---

## Usage

### Run Smoke Test

```bash
# Default: http://localhost:3000
pnpm test:frontend:smoke

# Custom base URL
PLAYWRIGHT_BASE_URL=https://mvp.getfansee.com pnpm test:frontend:smoke

# Or using NEXT_PUBLIC_BASE_URL
NEXT_PUBLIC_BASE_URL=http://localhost:4000 pnpm test:frontend:smoke
```

### Output

All artifacts are saved to `artifacts/agent-browser/`:

```
artifacts/agent-browser/
├── auth.json                    # DOM snapshot (JSON)
├── auth.png                     # Screenshot (PNG)
├── auth-errors.txt              # Errors (if any)
├── home.json
├── home.png
├── creator-new-post.json
├── creator-new-post.png
├── me-wallet.json
├── me-wallet.png
├── creator-upgrade.json
├── creator-upgrade.png
└── summary.json                 # Overall summary
```

---

## Routes Tested

The smoke test covers these key routes:

1. **`/auth`** - Authentication page
2. **`/home`** - Home feed
3. **`/creator/new-post`** - Creator post creation
4. **`/me/wallet`** - User wallet
5. **`/creator/upgrade`** - Creator upgrade flow

### Adding More Routes

Edit `scripts/agent-browser-smoke.ts`:

```typescript
const ROUTES = [
  { path: "/auth", name: "auth" },
  { path: "/home", name: "home" },
  // Add your route here:
  { path: "/new-route", name: "new-route" },
];
```

---

## Artifacts Explained

### 1. JSON Snapshots (`*.json`)

Contains DOM structure snapshot:

```json
{
  "title": "Page Title",
  "url": "http://localhost:3000/auth",
  "headings": [
    { "tag": "h1", "text": "Welcome", "classes": ["text-2xl"] }
  ],
  "buttons": [
    { "tag": "button", "text": "Sign In", "classes": ["btn-primary"] }
  ],
  "forms": [...],
  "links": [...],
  "errors": [...]
}
```

**Use for**:

- Verifying page structure
- Checking for unexpected error elements
- Validating key UI elements exist

### 2. Screenshots (`*.png`)

Full-page screenshots for visual inspection.

**Use for**:

- Visual regression detection (manual)
- UI layout validation
- Debugging rendering issues

### 3. Error Files (`*-errors.txt`)

Contains captured errors (if any):

```
Console Error: Failed to load resource: net::ERR_CONNECTION_REFUSED
Page Error: TypeError: Cannot read property 'map' of undefined
Request Failed: https://api.example.com/data - net::ERR_FAILED
```

**Use for**:

- Identifying console errors
- Detecting network failures
- Finding JavaScript exceptions

### 4. Summary (`summary.json`)

Overall test summary:

```json
{
  "timestamp": "2026-01-18T00:00:00.000Z",
  "baseUrl": "http://localhost:3000",
  "results": [...],
  "summary": {
    "passed": 4,
    "failed": 1,
    "totalErrors": 2
  }
}
```

---

## Interpreting Results

### Success Criteria

A route **passes** if:

- ✅ HTTP status < 400
- ✅ No console errors
- ✅ No page errors
- ✅ No failed network requests

### Exit Codes

- **0**: All routes passed
- **1**: One or more routes failed

### Console Output

```
🚀 Frontend Smoke Test with agent-browser
📍 Base URL: http://localhost:3000
📋 Routes to test: 5
============================================================

🧪 Testing route: /auth
  → Status: 200
  ✓ Snapshot saved: artifacts/agent-browser/auth.json
  ✓ Screenshot saved: artifacts/agent-browser/auth.png
  → Found button: "Sign In"
  → Found button: "Sign Up"
  ✅ Route OK

...

============================================================
📊 SMOKE TEST SUMMARY
============================================================
✅ Passed: 4/5
❌ Failed: 1/5
⚠️  Total Errors: 2

Detailed Results:
  ✅ /auth (1234ms)
      Interactions: Found: Sign In, Found: Sign Up
  ✅ /home (2345ms)
  ❌ /creator/new-post (3456ms)
      - Console Error: Failed to load resource
      - Request Failed: /api/posts - 500
  ✅ /me/wallet (1234ms)
  ✅ /creator/upgrade (2345ms)
```

---

## Best Practices

### 1. Run Locally Before Deployment

```bash
# Start dev server
pnpm dev

# In another terminal, run smoke test
pnpm test:frontend:smoke
```

### 2. Run Against Staging/Production

```bash
# Test staging
PLAYWRIGHT_BASE_URL=https://staging.getfansee.com pnpm test:frontend:smoke

# Test production (read-only, safe)
PLAYWRIGHT_BASE_URL=https://mvp.getfansee.com pnpm test:frontend:smoke
```

### 3. Review Artifacts

After running, review:

1. **Console output** - Quick overview
2. **Screenshots** - Visual validation
3. **Error files** - Detailed error messages
4. **JSON snapshots** - Structure validation

### 4. Don't Replace E2E Tests

This is **exploratory** testing. For critical user flows, always use Playwright E2E tests:

```bash
# Run full E2E suite
pnpm exec playwright test

# Run specific E2E test
pnpm exec playwright test tests/e2e/atomic-unlock.spec.ts
```

---

## Configuration

### Environment Variables

- `PLAYWRIGHT_BASE_URL` - Base URL for testing (default: `http://localhost:3000`)
- `NEXT_PUBLIC_BASE_URL` - Alternative base URL variable

### Timeout

Default: 30 seconds per route

Edit in `scripts/agent-browser-smoke.ts`:

```typescript
const TIMEOUT = 30000; // 30s
```

### Interactive Buttons

The script looks for these buttons (case-insensitive):

- "Continue"
- "Submit"
- "Unlock"
- "Recharge"
- "Get Started"
- "Sign In"
- "Sign Up"

Add more in `scripts/agent-browser-smoke.ts`:

```typescript
const INTERACTIVE_BUTTONS = [
  "Continue",
  "Submit",
  // Add yours:
  "Buy Now",
  "Subscribe",
];
```

---

## Troubleshooting

### Next.js Workspace Root Warning

**Issue**: Next.js may warn about incorrect workspace root detection if `package-lock.json` exists in home directory.

**Solution**: Renamed `~/package-lock.json` to `~/package-lock.json.bak` to prevent interference with pnpm workspace detection.

**Why**: Next.js scans parent directories for lockfiles. Multiple lockfiles (npm's `package-lock.json` in `~` + pnpm's `pnpm-lock.yaml` in project) cause incorrect root inference, leading to slow reloads and flaky behavior.

### Browser Installation Issues

If you see browser installation errors:

```bash
# Reinstall agent-browser browsers
pnpm agent-browser install
```

### Port Already in Use

If `localhost:3000` is busy:

```bash
# Use different port
PORT=4000 pnpm dev

# Then test with custom URL
PLAYWRIGHT_BASE_URL=http://localhost:4000 pnpm test:frontend:smoke
```

### Routes Require Authentication

If routes require auth, the smoke test will capture the redirect or login page. This is expected behavior for protected routes.

To test authenticated routes:

1. Use Playwright E2E tests with proper auth setup
2. Or manually test with browser

### macOS ARM64 Issues

The script uses **bundled Playwright Chromium** (not system Chrome) to avoid ARM64 compatibility issues.

If you still encounter issues:

```bash
# Check Playwright installation
pnpm exec playwright install --with-deps chromium
```

---

## Integration with CI (Optional)

While **not recommended** as a primary CI gate, you can add smoke tests to CI for additional validation:

```yaml
# .github/workflows/ci.yml
smoke-test:
  runs-on: ubuntu-latest
  needs: build
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 20
        cache: pnpm
    - run: pnpm install --frozen-lockfile
    - run: pnpm build
    - run: pnpm start &
    - run: sleep 10
    - run: pnpm test:frontend:smoke
    - uses: actions/upload-artifact@v4
      if: always()
      with:
        name: smoke-test-artifacts
        path: artifacts/agent-browser/
```

**Note**: Playwright E2E tests remain the primary CI gate.

---

## Comparison: Smoke Test vs E2E Test

| Feature           | Smoke Test                  | E2E Test                      |
| ----------------- | --------------------------- | ----------------------------- |
| **Purpose**       | Quick structural validation | Full user flow validation     |
| **Speed**         | Fast (~30s for 5 routes)    | Slower (~5min for full suite) |
| **Coverage**      | Surface-level               | Deep, comprehensive           |
| **Interactions**  | Best-effort discovery       | Explicit, scripted            |
| **CI Gate**       | ❌ No                       | ✅ Yes                        |
| **Manual Review** | ✅ Yes (screenshots, JSON)  | ❌ No (automated assertions)  |
| **Use Case**      | Pre-deployment sanity check | Regression prevention         |

---

## FAQ

### Q: Should I run this in CI?

**A**: Optional. Playwright E2E is the primary CI gate. Smoke tests are useful for quick local validation or as an additional CI check.

### Q: Can I use system Chrome?

**A**: No. The script uses bundled Playwright Chromium to avoid compatibility issues (especially on macOS ARM64).

### Q: How do I test authenticated routes?

**A**: Use Playwright E2E tests with proper auth setup. Smoke tests are not designed for authenticated flows.

### Q: What if a route redirects?

**A**: The smoke test will capture the final destination (e.g., `/auth` if redirected to login). Check the JSON snapshot for the actual URL.

### Q: Can I customize the snapshot structure?

**A**: Yes. Edit the `captureSnapshot` function in `scripts/agent-browser-smoke.ts`.

---

## Related Documentation

- **E2E Testing**: `docs/QA/E2E.md`
- **Testing Guide**: `e2e/TESTING_GUIDE.md`
- **CI Setup**: `.github/workflows/ci.yml`

---

**Last Updated**: 2026-01-18  
**Maintainer**: Chief QA
