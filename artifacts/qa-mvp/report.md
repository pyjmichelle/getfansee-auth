# MVP QA Report

**Date**: 2026-01-18T14:28:31.170Z

## Summary

| Metric      | Value |
| ----------- | ----- |
| Total Tests | 8     |
| Passed      | 0     |
| Failed      | 8     |
| Errors      | 0     |
| Pass Rate   | 0.0%  |
| Dead Clicks | 0     |

## Test Results

### ❌ Search opens modal (not page navigation)

- **ID**: search-modal
- **Route**: /home
- **Auth State**: fan
- **Status**: FAIL
- **Duration**: 22563ms
- **Final URL**: http://127.0.0.1:3000/home

**Failures**:

1. **Session validation failed for fan**
   - Expected: Valid fan session
   - Actual: Invalid or expired session

2. **Search modal/dialog should be visible**
   - Expected: Modal/dialog visible
   - Actual: Modal not found or not visible

3. **Search input should be visible**
   - Expected: Selector visible: input[type="search"], input[placeholder*="search" i]
   - Actual: Selector not found or not visible

**Evidence**:

- Screenshot: `/Users/puyijun/Downloads/authentication-flow-design (1)/artifacts/qa-mvp/search-modal.png`
- Trace: `/Users/puyijun/Downloads/authentication-flow-design (1)/artifacts/qa-mvp/traces/search-modal.zip`

### ❌ Creator can see upload area on new post page

- **ID**: post-creation-upload
- **Route**: /creator/new-post
- **Auth State**: creator
- **Status**: FAIL
- **Duration**: 5942ms
- **Final URL**: http://127.0.0.1:3000/creator/new-post

**Failures**:

1. **Session validation failed for creator**
   - Expected: Valid creator session
   - Actual: Invalid or expired session

2. **Required selector missing: input[type="file"], [data-testid="file-upload"], button:has-text("Upload")**
   - Expected: Selector visible: input[type="file"], [data-testid="file-upload"], button:has-text("Upload")
   - Actual: Selector not found or not visible

3. **Required selector missing: input[name="title"], input[placeholder*="title" i]**
   - Expected: Selector visible: input[name="title"], input[placeholder*="title" i]
   - Actual: Selector not found or not visible

4. **Required selector missing: textarea, [contenteditable="true"]**
   - Expected: Selector visible: textarea, [contenteditable="true"]
   - Actual: Selector not found or not visible

5. **Upload area/button should be visible**
   - Expected: Selector visible: input[type="file"], [data-testid="file-upload"], button:has-text("Upload"), label:has-text("Upload")
   - Actual: Selector not found or not visible

6. **Title input should be visible**
   - Expected: Selector visible: input[name="title"], input[placeholder*="title" i]
   - Actual: Selector not found or not visible

7. **Content input area should be visible**
   - Expected: Selector visible: textarea, [contenteditable="true"]
   - Actual: Selector not found or not visible

**Evidence**:

- Screenshot: `/Users/puyijun/Downloads/authentication-flow-design (1)/artifacts/qa-mvp/post-creation-upload.png`
- Trace: `/Users/puyijun/Downloads/authentication-flow-design (1)/artifacts/qa-mvp/traces/post-creation-upload.zip`

### ❌ Price input disabled when visibility=free

- **ID**: paywall-price-free
- **Route**: /creator/new-post
- **Auth State**: creator
- **Status**: FAIL
- **Duration**: 93198ms
- **Final URL**: http://127.0.0.1:3000/creator/new-post

**Failures**:

1. **Session validation failed for creator**
   - Expected: Valid creator session
   - Actual: Invalid or expired session

2. **Required selector missing: select[name="visibility"], [data-testid="visibility-select"]**
   - Expected: Selector visible: select[name="visibility"], [data-testid="visibility-select"]
   - Actual: Selector not found or not visible

3. **Required selector missing: input[name="price"], input[type="number"]**
   - Expected: Selector visible: input[name="price"], input[type="number"]
   - Actual: Selector not found or not visible

4. **Failed to execute interaction: select on select[name="visibility"], [data-testid="visibility-select"]**
   - Expected: Successfully select select[name="visibility"], [data-testid="visibility-select"]
   - Actual: Error: locator.selectOption: Timeout 30000ms exceeded.
     Call log:

- waiting for locator('select[name="visibility"], [data-testid="visibility-select"]').first()

5. **Price input should be disabled when visibility=free**
   - Expected: Element disabled
   - Actual: Element is enabled

**Evidence**:

- Screenshot: `/Users/puyijun/Downloads/authentication-flow-design (1)/artifacts/qa-mvp/paywall-price-free.png`
- Trace: `/Users/puyijun/Downloads/authentication-flow-design (1)/artifacts/qa-mvp/traces/paywall-price-free.zip`

### ❌ Price input enabled when visibility=paid

- **ID**: paywall-price-paid
- **Route**: /creator/new-post
- **Auth State**: creator
- **Status**: FAIL
- **Duration**: 64957ms
- **Final URL**: http://127.0.0.1:3000/creator/new-post

**Failures**:

1. **Session validation failed for creator**
   - Expected: Valid creator session
   - Actual: Invalid or expired session

2. **Failed to execute interaction: select on select[name="visibility"], [data-testid="visibility-select"]**
   - Expected: Successfully select select[name="visibility"], [data-testid="visibility-select"]
   - Actual: Error: locator.selectOption: Timeout 30000ms exceeded.
     Call log:

- waiting for locator('select[name="visibility"], [data-testid="visibility-select"]').first()

3. **Price input should be enabled when visibility=paid**
   - Expected: Element enabled
   - Actual: Element is disabled

**Evidence**:

- Screenshot: `/Users/puyijun/Downloads/authentication-flow-design (1)/artifacts/qa-mvp/paywall-price-paid.png`
- Trace: `/Users/puyijun/Downloads/authentication-flow-design (1)/artifacts/qa-mvp/traces/paywall-price-paid.zip`

### ❌ Fan wallet page should not trigger unauthorized requests

- **ID**: wallet-no-unauthorized
- **Route**: /me/wallet
- **Auth State**: fan
- **Status**: FAIL
- **Duration**: 4406ms
- **Final URL**: http://127.0.0.1:3000/me/wallet

**Failures**:

1. **Session validation failed for fan**
   - Expected: Valid fan session
   - Actual: Invalid or expired session

2. **Required selector missing: [data-testid="wallet-balance"], .balance, h1:has-text("Wallet")**
   - Expected: Selector visible: [data-testid="wallet-balance"], .balance, h1:has-text("Wallet")
   - Actual: Selector not found or not visible

3. **Wallet balance section should be visible**
   - Expected: Selector visible: [data-testid="wallet-balance"], .balance, h2:has-text("Balance"), h3:has-text("Balance")
   - Actual: Selector not found or not visible

**Evidence**:

- Screenshot: `/Users/puyijun/Downloads/authentication-flow-design (1)/artifacts/qa-mvp/wallet-no-unauthorized.png`
- Trace: `/Users/puyijun/Downloads/authentication-flow-design (1)/artifacts/qa-mvp/traces/wallet-no-unauthorized.zip`

### ❌ Home feed loads posts for fan

- **ID**: home-feed-loads
- **Route**: /home
- **Auth State**: fan
- **Status**: FAIL
- **Duration**: 12885ms
- **Final URL**: http://127.0.0.1:3000/home

**Failures**:

1. **Session validation failed for fan**
   - Expected: Valid fan session
   - Actual: Invalid or expired session

2. **Required selector missing: [data-testid="post"], article, .post-card**
   - Expected: Selector visible: [data-testid="post"], article, .post-card
   - Actual: Selector not found or not visible

3. **At least one post should be visible**
   - Expected: Selector visible: [data-testid="post"], article, .post-card
   - Actual: Selector not found or not visible

**Evidence**:

- Screenshot: `/Users/puyijun/Downloads/authentication-flow-design (1)/artifacts/qa-mvp/home-feed-loads.png`
- Trace: `/Users/puyijun/Downloads/authentication-flow-design (1)/artifacts/qa-mvp/traces/home-feed-loads.zip`

### ❌ Creator can access studio dashboard

- **ID**: creator-studio-dashboard
- **Route**: /creator/studio
- **Auth State**: creator
- **Status**: FAIL
- **Duration**: 2691ms
- **Final URL**: http://127.0.0.1:3000/creator/studio

**Failures**:

1. **Session validation failed for creator**
   - Expected: Valid creator session
   - Actual: Invalid or expired session

2. **Required selector missing: h1:has-text("Studio"), h1:has-text("Dashboard")**
   - Expected: Selector visible: h1:has-text("Studio"), h1:has-text("Dashboard")
   - Actual: Selector not found or not visible

3. **Required selector missing: [data-testid="stats"], .stats, .analytics**
   - Expected: Selector visible: [data-testid="stats"], .stats, .analytics
   - Actual: Selector not found or not visible

4. **Studio heading should be visible**
   - Expected: Selector visible: h1:has-text("Studio"), h1:has-text("Dashboard"), h2:has-text("Studio")
   - Actual: Selector not found or not visible

**Evidence**:

- Screenshot: `/Users/puyijun/Downloads/authentication-flow-design (1)/artifacts/qa-mvp/creator-studio-dashboard.png`
- Trace: `/Users/puyijun/Downloads/authentication-flow-design (1)/artifacts/qa-mvp/traces/creator-studio-dashboard.zip`

### ❌ Creator can view earnings

- **ID**: creator-earnings
- **Route**: /creator/studio/earnings
- **Auth State**: creator
- **Status**: FAIL
- **Duration**: 2668ms
- **Final URL**: http://127.0.0.1:3000/creator/studio/earnings

**Failures**:

1. **Session validation failed for creator**
   - Expected: Valid creator session
   - Actual: Invalid or expired session

2. **Required selector missing: [data-testid="earnings"], .earnings, h1:has-text("Earnings")**
   - Expected: Selector visible: [data-testid="earnings"], .earnings, h1:has-text("Earnings")
   - Actual: Selector not found or not visible

3. **Earnings section should be visible**
   - Expected: Selector visible: [data-testid="earnings"], .earnings, h2:has-text("Earnings"), h3:has-text("Earnings")
   - Actual: Selector not found or not visible

**Evidence**:

- Screenshot: `/Users/puyijun/Downloads/authentication-flow-design (1)/artifacts/qa-mvp/creator-earnings.png`
- Trace: `/Users/puyijun/Downloads/authentication-flow-design (1)/artifacts/qa-mvp/traces/creator-earnings.zip`
