# Frontend Smoke Test - Example Output

This document shows example output from running the frontend smoke test.

## Command

```bash
pnpm test:frontend:smoke
```

## Console Output

```
🚀 Frontend Smoke Test with agent-browser
📍 Base URL: http://localhost:3000
📋 Routes to test: 5
============================================================

📁 Artifacts directory: /Users/.../artifacts/agent-browser

🌐 Launching browser...
  ✓ Browser launched

🧪 Testing route: /auth
  → Status: 200
  ✓ Snapshot saved: artifacts/agent-browser/auth.json
  ✓ Screenshot saved: artifacts/agent-browser/auth.png
  → Found button: "Sign In"
  → Found button: "Sign Up"
  ✅ Route OK

🧪 Testing route: /home
  → Status: 200
  ✓ Snapshot saved: artifacts/agent-browser/home.json
  ✓ Screenshot saved: artifacts/agent-browser/home.png
  → Found button: "Continue"
  ✅ Route OK

🧪 Testing route: /creator/new-post
  → Status: 200
  ✓ Snapshot saved: artifacts/agent-browser/creator-new-post.json
  ✓ Screenshot saved: artifacts/agent-browser/creator-new-post.png
  → Found button: "Submit"
  ✅ Route OK

🧪 Testing route: /me/wallet
  → Status: 200
  ✓ Snapshot saved: artifacts/agent-browser/me-wallet.json
  ✓ Screenshot saved: artifacts/agent-browser/me-wallet.png
  → Found button: "Recharge"
  ✅ Route OK

🧪 Testing route: /creator/upgrade
  → Status: 200
  ✓ Snapshot saved: artifacts/agent-browser/creator-upgrade.json
  ✓ Screenshot saved: artifacts/agent-browser/creator-upgrade.png
  → Found button: "Get Started"
  ✅ Route OK

============================================================
📊 SMOKE TEST SUMMARY
============================================================
✅ Passed: 5/5
❌ Failed: 0/5
⚠️  Total Errors: 0

Detailed Results:
  ✅ /auth (1234ms)
      Interactions: Found: Sign In, Found: Sign Up
  ✅ /home (2345ms)
      Interactions: Found: Continue
  ✅ /creator/new-post (3456ms)
      Interactions: Found: Submit
  ✅ /me/wallet (1234ms)
      Interactions: Found: Recharge
  ✅ /creator/upgrade (2345ms)
      Interactions: Found: Get Started

📄 Summary saved: artifacts/agent-browser/summary.json

🔒 Browser closed

✅ All routes passed smoke test
```

## Generated Artifacts

### Directory Structure

```
artifacts/agent-browser/
├── auth.json
├── auth.png
├── home.json
├── home.png
├── creator-new-post.json
├── creator-new-post.png
├── me-wallet.json
├── me-wallet.png
├── creator-upgrade.json
├── creator-upgrade.png
└── summary.json
```

### Example: auth.json

```json
{
  "title": "Authentication - GetFansee",
  "url": "http://localhost:3000/auth",
  "headings": [
    {
      "tag": "h1",
      "classes": ["text-3xl", "font-bold"],
      "text": "Welcome to GetFansee"
    },
    {
      "tag": "h2",
      "classes": ["text-xl", "text-gray-600"],
      "text": "Sign in to continue"
    }
  ],
  "buttons": [
    {
      "tag": "button",
      "classes": ["btn-primary", "w-full"],
      "text": "Sign In"
    },
    {
      "tag": "button",
      "classes": ["btn-secondary", "w-full"],
      "text": "Sign Up"
    }
  ],
  "forms": [
    {
      "tag": "form",
      "id": "auth-form",
      "classes": ["space-y-4"]
    }
  ],
  "links": [
    {
      "tag": "a",
      "classes": ["text-blue-500", "hover:underline"],
      "text": "Forgot password?"
    }
  ],
  "errors": []
}
```

### Example: summary.json

```json
{
  "timestamp": "2026-01-18T00:00:00.000Z",
  "baseUrl": "http://localhost:3000",
  "results": [
    {
      "route": "/auth",
      "success": true,
      "snapshot": { "title": "Authentication - GetFansee", "..." },
      "errors": [],
      "screenshot": "artifacts/agent-browser/auth.png",
      "interactions": ["Found: Sign In", "Found: Sign Up"],
      "duration": 1234
    },
    {
      "route": "/home",
      "success": true,
      "snapshot": { "title": "Home - GetFansee", "..." },
      "errors": [],
      "screenshot": "artifacts/agent-browser/home.png",
      "interactions": ["Found: Continue"],
      "duration": 2345
    }
  ],
  "summary": {
    "passed": 5,
    "failed": 0,
    "totalErrors": 0
  }
}
```

## Example with Errors

If a route has errors, the output would look like:

```
🧪 Testing route: /creator/new-post
  → Status: 200
  ✓ Snapshot saved: artifacts/agent-browser/creator-new-post.json
  ✓ Screenshot saved: artifacts/agent-browser/creator-new-post.png
  ⚠ Errors saved: artifacts/agent-browser/creator-new-post-errors.txt
  ⚠️  Route has issues (2 errors)
```

### Example: creator-new-post-errors.txt

```
Console Error: Failed to load resource: the server responded with a status of 500 (Internal Server Error)
Request Failed: http://localhost:3000/api/posts - net::ERR_FAILED
```

## Exit Codes

- **Exit 0**: All tests passed
- **Exit 1**: One or more tests failed

## Usage in Scripts

```bash
# Run smoke test and check exit code
if pnpm test:frontend:smoke; then
  echo "✅ Smoke test passed"
else
  echo "❌ Smoke test failed"
  exit 1
fi
```

## CI Integration Example

```yaml
- name: Run Frontend Smoke Test
  run: pnpm test:frontend:smoke

- name: Upload Smoke Test Artifacts
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: smoke-test-artifacts
    path: artifacts/agent-browser/
    retention-days: 7
```

---

**Note**: This is example output. Actual output will vary based on your application's routes and content.
