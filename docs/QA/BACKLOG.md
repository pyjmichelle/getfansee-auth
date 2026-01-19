# Full Site Audit - Backlog

**Generated**: 2026-01-18  
**Source**: Full Site Interactive Audit  
**Total Issues**: 11 (7 P0, 4 P1)

---

## P0 Issues (Blocking MVP)

### P0-1: Auth Context Not Persisting in Audit Tool

**Route**: All protected routes  
**Auth State**: Fan, Creator  
**Owner**: QA + FE

**Problem**:
Audit tool doesn't implement proper auth contexts. All "fan" and "creator" tests fall back to anonymous, causing false positives for auth redirects.

**Expected**:

- Fan context should maintain authenticated session with `role=fan`
- Creator context should maintain authenticated session with `role=creator`
- Auth cookies/tokens should persist across page navigations

**Actual**:

- All auth states use anonymous context
- Protected routes always redirect to `/auth`

**Reproduction**:

```bash
pnpm audit:full
# Observe: "⚠️  Auth state 'fan' not yet implemented - using anonymous"
```

**Evidence**:

- `artifacts/agent-browser-full/audit-results.json` - All fan/creator tests show redirects
- Console output: "Auth state 'fan' not yet implemented"

**Fix**:

1. Implement `createAuthContext()` in `scripts/full-site-audit.ts`
2. Add login flow using Supabase auth
3. Store auth cookies in browser context
4. Verify auth persistence with test API call

**Acceptance Criteria**:

- [ ] Fan context successfully logs in as fan
- [ ] Creator context successfully logs in as creator
- [ ] Auth cookies persist across page navigations
- [ ] Protected routes load correctly for authenticated users
- [ ] Re-run audit shows 0 false positive redirects

**Test Cases** (Playwright):

```typescript
test("Fan auth context persists", async ({ browser }) => {
  const context = await createAuthContext(browser, "fan");
  const page = await context.newPage();
  await page.goto("/home");
  expect(page.url()).not.toContain("/auth");
});
```

---

### P0-2: Creator Studio Pages Make Premature API Calls

**Route**: `/creator/studio`, `/creator/studio/earnings`, `/creator/studio/subscribers`  
**Auth State**: Anonymous, Fan  
**Owner**: FE

**Problem**:
Pages make API calls before auth check completes, resulting in 401 errors and console errors.

**Expected**:

1. Check auth first
2. If not authenticated → redirect to `/auth`
3. If authenticated but not creator → redirect to `/creator/upgrade`
4. Only then make API calls

**Actual**:

- API calls fire immediately on page load
- Auth check happens in parallel
- Results in network errors and console errors

**Reproduction**:

```bash
# Visit as anonymous
curl -I http://127.0.0.1:3000/creator/studio
# Observe: GET /api/creator/studio - 401
```

**Evidence**:

- `artifacts/agent-browser-full/audit-results.json` - Network errors on these routes
- Console errors: "Failed to load creator data"
- Screenshots show error states with 0 clickable elements

**Fix**:

```typescript
// In creator studio pages
useEffect(() => {
  const checkAuthAndLoad = async () => {
    setIsLoading(true);

    // 1. Check auth first
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push("/auth");
      return;
    }

    // 2. Check role
    const profile = await fetchProfile();
    if (profile.role !== "creator") {
      router.push("/creator/upgrade");
      return;
    }

    // 3. Only now fetch data
    await fetchCreatorData();
    setIsLoading(false);
  };

  checkAuthAndLoad();
}, []);

// Show loading state while checking
if (isLoading) return <LoadingSpinner />;
```

**Acceptance Criteria**:

- [ ] No API calls before auth check completes
- [ ] Anonymous users redirected to `/auth` immediately
- [ ] Non-creators redirected to `/creator/upgrade`
- [ ] Creators see data loaded successfully
- [ ] 0 console errors
- [ ] 0 network errors for unauthorized users

**Test Cases**:

```typescript
test("Creator studio checks auth before API calls", async ({ page }) => {
  const apiCalls = [];
  page.on("request", (req) => apiCalls.push(req.url()));

  await page.goto("/creator/studio");

  // Should redirect before any API calls
  expect(page.url()).toContain("/auth");
  expect(apiCalls.filter((url) => url.includes("/api/"))).toHaveLength(0);
});
```

---

### P0-3: Home/Me Pages Don't Recognize Auth

**Route**: `/home`, `/me`, `/me/wallet`  
**Auth State**: Fan, Creator  
**Owner**: Auth + FE

**Problem**:
Authenticated users are redirected to `/auth` even though they have valid sessions.

**Expected**:

- Authenticated users see their home feed
- Profile page loads user data
- Wallet shows balance

**Actual**:

- All authenticated users redirected to `/auth?mode=login`
- Auth check fails even with valid session

**Reproduction**:

```bash
# Login as fan, then visit
curl -I http://127.0.0.1:3000/home -H "Cookie: <auth-cookie>"
# Observe: 302 redirect to /auth
```

**Evidence**:

- `artifacts/agent-browser-full/audit-results.json` - All fan/creator tests redirect
- Note: May be false positive due to P0-1 (audit tool auth not implemented)

**Fix**:

1. Verify auth middleware is correctly checking session
2. Ensure cookies are properly set and read
3. Check for race conditions in auth check
4. Add proper loading states

**Acceptance Criteria**:

- [ ] Fan users see home feed
- [ ] Creator users see home feed
- [ ] Profile page loads user data
- [ ] Wallet page loads balance
- [ ] No redirects for authenticated users
- [ ] Re-run audit with proper auth contexts

**Test Cases**:

```typescript
test("Authenticated fan accesses home", async ({ page, context }) => {
  await loginAsFan(context);
  await page.goto("/home");
  expect(page.url()).toBe("http://localhost:3000/home");
  await expect(page.locator("h1")).toContainText("Home");
});
```

---

### P0-4: Creator New-Post Blocks Authenticated Users

**Route**: `/creator/new-post`  
**Auth State**: Fan, Creator  
**Owner**: FE

**Problem**:
Page redirects all users to `/auth`, even authenticated creators.

**Expected**:

- Anonymous → redirect to `/auth`
- Fan → show "Become a Creator" prompt
- Creator → show post creation form

**Actual**:

- All users redirected to `/auth`

**Reproduction**:

```bash
# Login as creator, then visit
curl -I http://127.0.0.1:3000/creator/new-post -H "Cookie: <creator-cookie>"
# Observe: 302 redirect to /auth
```

**Evidence**:

- `artifacts/agent-browser-full/audit-results.json` - All states redirect
- Note: May be false positive due to P0-1

**Fix**:
Already fixed in previous commit (conditional TagSelector rendering). Verify with proper auth context.

**Acceptance Criteria**:

- [ ] Anonymous users redirected to `/auth`
- [ ] Fan users see upgrade prompt
- [ ] Creator users see post form
- [ ] No premature API calls
- [ ] Re-test with proper auth

**Test Cases**:

```typescript
test("Creator sees post form", async ({ page, context }) => {
  await loginAsCreator(context);
  await page.goto("/creator/new-post");
  await expect(page.locator("h1")).toContainText("Create New Post");
  await expect(page.locator("form")).toBeVisible();
});

test("Fan sees upgrade prompt", async ({ page, context }) => {
  await loginAsFan(context);
  await page.goto("/creator/new-post");
  await expect(page.locator("text=Become a Creator")).toBeVisible();
});
```

---

### P0-5: Wallet Page Makes Premature API Call

**Route**: `/me/wallet`  
**Auth State**: Fan  
**Owner**: FE

**Problem**:
Wallet page calls `/api/wallet` before auth check completes.

**Expected**:

1. Check auth
2. If authenticated, fetch wallet data
3. Show balance

**Actual**:

- API call fires immediately
- Results in network error for unauthenticated users

**Reproduction**:

```bash
# Visit as anonymous
curl -I http://127.0.0.1:3000/me/wallet
# Observe: GET /api/wallet - Failed
```

**Evidence**:

- `artifacts/agent-browser-full/audit-results.json` - Network error on fan state
- Console shows failed API call

**Fix**:
Same pattern as P0-2 - delay API call until auth confirmed.

**Acceptance Criteria**:

- [ ] No API calls before auth check
- [ ] Anonymous users redirected immediately
- [ ] Authenticated users see wallet balance
- [ ] 0 network errors

**Test Cases**:

```typescript
test("Wallet checks auth before API call", async ({ page }) => {
  const apiCalls = [];
  page.on("request", (req) => apiCalls.push(req.url()));

  await page.goto("/me/wallet");

  expect(page.url()).toContain("/auth");
  expect(apiCalls.filter((url) => url.includes("/api/wallet"))).toHaveLength(0);
});
```

---

### P0-6: Creator Earnings Page Fails

**Route**: `/creator/studio/earnings`  
**Auth State**: Fan, Creator  
**Owner**: FE + BE

**Problem**:
Page loads but shows error state with 0 clickable elements. API returns 401.

**Expected**:

- Fan → redirect to `/creator/upgrade`
- Creator → show earnings data

**Actual**:

- Page loads for both
- API call fails with 401
- Console error: "Failed to load earnings data"
- 0 clickable elements (error state)

**Reproduction**:

```bash
# Visit as fan
curl http://127.0.0.1:3000/creator/studio/earnings
# Observe: Page loads, then API fails
```

**Evidence**:

- `artifacts/agent-browser-full/audit-results.json` - Console + network errors
- Screenshots show error state

**Fix**:

1. Add auth + role check before rendering
2. Fix API to return 403 (not 401) for authenticated non-creators
3. Add proper error handling
4. Redirect non-creators to upgrade page

**Acceptance Criteria**:

- [ ] Fan users redirected to `/creator/upgrade`
- [ ] Creator users see earnings data
- [ ] API returns 403 for non-creators
- [ ] No console errors
- [ ] Proper loading states

**Test Cases**:

```typescript
test("Earnings page redirects non-creators", async ({ page, context }) => {
  await loginAsFan(context);
  await page.goto("/creator/studio/earnings");
  expect(page.url()).toContain("/creator/upgrade");
});

test("Creator sees earnings", async ({ page, context }) => {
  await loginAsCreator(context);
  await page.goto("/creator/studio/earnings");
  await expect(page.locator("h1")).toContainText("Earnings");
  await expect(page.locator("[data-testid='balance']")).toBeVisible();
});
```

---

### P0-7: Creator Subscribers Page Fails

**Route**: `/creator/studio/subscribers`  
**Auth State**: All  
**Owner**: FE + BE

**Problem**:

- Anonymous: Redirects (correct)
- Fan: Redirects (should show upgrade)
- Creator: Redirects (should show subscribers)
- Network error on all states

**Expected**:

- Anonymous → redirect to `/auth`
- Fan → redirect to `/creator/upgrade`
- Creator → show subscribers list

**Actual**:

- All states redirect to `/auth`
- Network error: `GET /api/subscribers - Failed`

**Reproduction**:

```bash
curl http://127.0.0.1:3000/creator/studio/subscribers
# Observe: Network error
```

**Evidence**:

- `artifacts/agent-browser-full/audit-results.json` - Network errors on all states

**Fix**:

1. Fix auth guard logic
2. Implement `/api/subscribers` endpoint
3. Add role-based access control
4. Test with proper auth contexts

**Acceptance Criteria**:

- [ ] Anonymous redirected to `/auth`
- [ ] Fan redirected to `/creator/upgrade`
- [ ] Creator sees subscribers list
- [ ] API endpoint works
- [ ] No network errors

**Test Cases**:

```typescript
test("Subscribers page shows list for creator", async ({ page, context }) => {
  await loginAsCreator(context);
  await page.goto("/creator/studio/subscribers");
  await expect(page.locator("h1")).toContainText("Subscribers");
  await expect(page.locator("[data-testid='subscriber-list']")).toBeVisible();
});
```

---

## P1 Issues (Important)

### P1-1: Root Should Redirect Authenticated Users

**Route**: `/`  
**Auth State**: Fan, Creator  
**Owner**: FE

**Problem**:
Authenticated users visiting root are redirected to `/auth` instead of `/home`.

**Expected**:

- Anonymous → `/auth`
- Authenticated → `/home`

**Actual**:

- All users → `/auth`

**Fix**:

```typescript
// In middleware or root page
if (session) {
  return NextResponse.redirect(new URL("/home", request.url));
}
```

**Acceptance Criteria**:

- [ ] Anonymous users see auth page
- [ ] Authenticated users see home feed

---

### P1-2: Auth Page Accessible to Authenticated Users

**Route**: `/auth`  
**Auth State**: Fan, Creator  
**Owner**: FE

**Problem**:
Authenticated users can access auth page. Should redirect to `/home`.

**Expected**:

- If already logged in → redirect to `/home`

**Actual**:

- Auth page loads for all users

**Fix**:

```typescript
// In /auth page
useEffect(() => {
  const checkAuth = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) {
      router.push("/home");
    }
  };
  checkAuth();
}, []);
```

**Acceptance Criteria**:

- [ ] Authenticated users redirected to `/home`
- [ ] Anonymous users see auth form

---

### P1-3: Creator Analytics Accessible Without Auth

**Route**: `/creator/studio/analytics`  
**Auth State**: Anonymous, Fan  
**Owner**: FE

**Problem**:
Analytics page loads for all users without auth check. Should require creator role.

**Expected**:

- Anonymous → redirect to `/auth`
- Fan → redirect to `/creator/upgrade`
- Creator → show analytics

**Actual**:

- All users see analytics page (11 clickable elements)

**Fix**:
Add auth + role guard at page entry.

**Acceptance Criteria**:

- [ ] Anonymous users redirected to `/auth`
- [ ] Non-creators redirected to `/creator/upgrade`
- [ ] Creators see analytics data

---

### P1-4: Creator Onboarding Fails to Load

**Route**: `/creator/onboarding`  
**Auth State**: Creator  
**Owner**: FE + BE

**Problem**:
Page loads but shows error. API call fails with 401.

**Expected**:

- Creator sees onboarding flow
- API returns onboarding status

**Actual**:

- Console error: "Failed to load onboarding status"
- Network error: `GET /api/onboarding - 401`
- 0 clickable elements

**Fix**:

1. Implement `/api/onboarding` endpoint
2. Add proper auth handling
3. Return onboarding status

**Acceptance Criteria**:

- [ ] Creator sees onboarding steps
- [ ] API works correctly
- [ ] No errors

---

## Summary by Owner

| Owner | P0  | P1  | Total |
| ----- | --- | --- | ----- |
| FE    | 4   | 3   | 7     |
| Auth  | 2   | 0   | 2     |
| BE    | 1   | 1   | 2     |
| FE+BE | 3   | 0   | 3     |
| QA    | 1   | 0   | 1     |

---

## Implementation Order

### Phase 1: Auth Foundation (P0-1, P0-3)

1. Implement auth contexts in audit tool
2. Fix auth persistence issues
3. Re-run audit to verify

### Phase 2: Page Guards (P0-2, P0-4, P0-5)

1. Add auth checks before API calls
2. Implement proper loading states
3. Add role-based redirects

### Phase 3: Creator Pages (P0-6, P0-7)

1. Fix creator studio pages
2. Implement missing API endpoints
3. Add proper error handling

### Phase 4: Polish (P1-1 through P1-4)

1. Fix root/auth redirects
2. Add role guards to analytics
3. Fix onboarding page

---

## Testing Checklist

After each fix:

- [ ] Run `pnpm audit:full` with proper auth
- [ ] Verify 0 console errors
- [ ] Verify 0 network errors
- [ ] Check screenshots for visual issues
- [ ] Test all clickable elements
- [ ] Run Playwright E2E tests
- [ ] Update this backlog

---

**Status**: ✅ Backlog Complete  
**Next**: Await user confirmation to proceed with fixes
