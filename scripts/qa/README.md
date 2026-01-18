# QA Loop - Automated Self-Check Pipeline

**Status**: ✅ Ready to Use

---

## Quick Start

```bash
pnpm qa:loop
```

**What it does**: Runs a complete, automated QA pipeline from clean state to full audit.

**Time**: 5-10 minutes (including 2 manual logins)

---

## Pipeline Steps

### 1. Clean State

- Kill any existing dev servers on port 3000
- Remove stale `.next/dev/lock` files
- Create artifacts directories

### 2. Start Dev Server

- Start `pnpm dev` in background
- Wait for `/auth` to return 200/307/302 (max 60s)
- Save server logs to `artifacts/qa/server.log`

### 3. Smoke Check

- Test blocker endpoint: `/api/tags?category=content`
- Must return HTTP 200
- If fails, print last 80 lines of server log and exit

### 4. Export Sessions

- Run `pnpm test:session:export:fan`
  - **You need to manually login**: `fan@test.com` / `TestFan123!`
- Run `pnpm test:session:export:creator`
  - **You need to manually login**: `creator@test.com` / `TestCreator123!`
- Verify session files exist

### 5. Run Full Audit

- Run `pnpm audit:full`
- Verify output contains "Testing as: FAN" and "Testing as: CREATOR"
- Ensure no "missing session file" errors

### 6. Final Verification

- Check all expected files exist:
  - `artifacts/agent-browser-full/sessions/fan.json`
  - `artifacts/agent-browser-full/sessions/creator.json`
  - `artifacts/agent-browser-full/sessions/*-post-login.png`
  - `artifacts/agent-browser-full/summary.json`
  - `artifacts/agent-browser-full/audit-results.json`
- Print file list and summary

---

## Manual Steps Required

**You will need to login twice**:

1. **Fan login** (when browser opens):
   - Email: `fan@test.com`
   - Password: `TestFan123!`
   - Click "Sign In"
   - Wait for browser to auto-close

2. **Creator login** (when browser opens again):
   - Email: `creator@test.com`
   - Password: `TestCreator123!`
   - Click "Sign In"
   - Wait for browser to auto-close

**Total manual time**: ~30 seconds (2 logins)

---

## Output

### Success Output

```
============================================================
✅ QA LOOP COMPLETE
============================================================
[✓] All checks passed!
[INFO] Server log saved to: artifacts/qa/server.log
[INFO] Artifacts saved to: artifacts/qa
```

### Failure Output

Script will **fail fast** with clear error messages:

```
[✗] Endpoint returned HTTP 500 (expected 200)
[✗] Last 80 lines of server log:
...
```

---

## Generated Files

After successful run:

```
artifacts/
├── qa/
│   └── server.log                    # Dev server logs
└── agent-browser-full/
    ├── sessions/
    │   ├── fan.json                  # Fan session state
    │   ├── creator.json              # Creator session state
    │   ├── fan-post-login.png        # Fan verification screenshot
    │   └── creator-post-login.png    # Creator verification screenshot
    ├── summary.json                  # Audit summary
    ├── audit-results.json            # Detailed audit results
    ├── anonymous/                    # 20 screenshots
    ├── fan/                          # 20 screenshots
    └── creator/                      # 20 screenshots
```

**Total**: ~65 files

---

## Troubleshooting

### Error: "Port 3000 already in use"

**Solution**: Script automatically kills existing processes. If it persists:

```bash
lsof -ti:3000 | xargs kill -9
pnpm qa:loop
```

### Error: "Server failed to start within 60s"

**Cause**: Dev server startup issue

**Solution**: Check `artifacts/qa/server.log` for errors

### Error: "Failed to export fan session"

**Cause**: Login timeout or wrong credentials

**Solution**:

1. Ensure test accounts exist: `pnpm exec tsx scripts/auth/create-test-accounts.ts`
2. Re-run: `pnpm qa:loop`
3. Login faster (within 2 minutes)

### Error: "Audit output missing 'Testing as: FAN'"

**Cause**: Session files not loaded properly

**Solution**:

1. Delete old sessions: `rm -rf artifacts/agent-browser-full/sessions/*`
2. Re-run: `pnpm qa:loop`

---

## Cleanup

Script automatically cleans up:

- Stops dev server on exit (trap EXIT)
- Kills processes on port 3000
- Saves server log before exit

**Manual cleanup** (if script crashes):

```bash
lsof -ti:3000 | xargs kill -9
rm -f .next/dev/lock
```

---

## CI Integration

To run in CI (non-interactive):

1. Pre-create session files (one-time):

   ```bash
   pnpm test:session:export:fan
   pnpm test:session:export:creator
   git add artifacts/agent-browser-full/sessions/*.json
   git commit -m "Add pre-authenticated sessions for CI"
   ```

2. Modify `scripts/qa/loop.sh` to skip step 4 if sessions exist:

   ```bash
   if [ -f "$FAN_SESSION" ] && [ -f "$CREATOR_SESSION" ]; then
     log_info "Sessions already exist, skipping export"
   else
     # ... export logic
   fi
   ```

3. Add to `.github/workflows/ci.yml`:
   ```yaml
   - name: Run QA Loop
     run: pnpm qa:loop
   ```

---

## Performance

- **Cold start**: 5-10 minutes (with manual logins)
- **Warm start**: 3-5 minutes (if sessions exist)
- **Server startup**: 5-15 seconds
- **Audit**: 2-3 minutes (60 routes)

---

## Exit Codes

- `0`: Success
- `1`: Failure (with detailed error message)

---

**Last Updated**: 2026-01-18
