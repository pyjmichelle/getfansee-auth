# Deployment Checklist - MVP Monetization (Sprint P0)

**Date**: 2026-01-18
**Feature**: Atomic PPV Unlock with Accounting Integrity

---

## Pre-Deployment

### 1. Database Migration

- [ ] **Backup database** (Supabase Dashboard → Database → Backups)
- [ ] **Run pre-check**:
  ```sql
  -- Copy/paste from migrations/024_pre_check.sql
  -- Review output for issues
  ```
- [ ] **Run safe migration**:
  ```sql
  -- Copy/paste from migrations/024_atomic_unlock_ppv_safe.sql
  -- Wait for "SUCCESS: Migration completed successfully!" message
  ```
- [ ] **Verify migration**:

  ```sql
  -- Check function exists
  SELECT proname FROM pg_proc WHERE proname = 'unlock_ppv';

  -- Check columns
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'profiles' AND column_name = 'username';

  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'purchases' AND column_name = 'idempotency_key';

  -- No duplicate usernames
  SELECT username, COUNT(*) FROM profiles
  GROUP BY username HAVING COUNT(*) > 1;
  ```

### 2. Code Review

- [ ] Review `app/api/unlock/route.ts` changes
- [ ] Review `lib/paywall.ts` changes
- [ ] Review `components/paywall-modal.tsx` changes
- [ ] Check TypeScript: `pnpm type-check` (should pass)
- [ ] Check ESLint: `pnpm lint` (0 errors expected)

### 3. Local Testing

- [ ] Build succeeds: `pnpm build`
- [ ] E2E tests syntax valid: `pnpm exec playwright test tests/e2e/atomic-unlock.spec.ts --list`
- [ ] Manual test unlock flow locally

---

## Deployment

### 1. Deploy Code

```bash
# Build production
pnpm build

# Deploy to your platform (Vercel/etc)
# OR manual deployment:
# - Upload .next/ folder
# - Upload updated source files
# - Restart server
```

### 2. Verify Deployment

- [ ] Site loads: `https://mvp.getfansee.com`
- [ ] No console errors in browser
- [ ] API endpoint responds: `POST /api/unlock`

---

## Post-Deployment Testing

### 1. Smoke Test (5 minutes)

- [ ] **Register new Fan account**
- [ ] **Navigate to PPV post**
- [ ] **Click "Unlock" button**
- [ ] **Verify**: Paywall modal opens
- [ ] **Verify**: Balance displayed correctly
- [ ] **If balance insufficient**: "Add Funds" button appears
- [ ] **If balance sufficient**: "Unlock for $X" button appears

### 2. Full Flow Test (15 minutes)

#### Test A: Successful Unlock

- [ ] Fan has $10 balance
- [ ] Unlock $5 PPV post
- [ ] Content unblurs immediately (no refresh)
- [ ] Balance updates to $5
- [ ] Check `/purchases` page - purchase appears
- [ ] Refresh page - content still unlocked

#### Test B: Idempotency

- [ ] Fan has $10 balance
- [ ] Click "Unlock" button rapidly 3 times
- [ ] Only charged once ($5)
- [ ] Final balance is $5 (not $0)

#### Test C: Insufficient Balance

- [ ] Fan has $0 balance
- [ ] Try to unlock $10 post
- [ ] "Add Funds to Wallet" button appears
- [ ] Click button → redirects to `/me/wallet`
- [ ] No purchase created
- [ ] No balance deducted

### 3. Database Verification (5 minutes)

```sql
-- Check purchase-transaction consistency
SELECT
  (SELECT COUNT(*) FROM purchases WHERE created_at > NOW() - INTERVAL '1 hour') as purchases,
  (SELECT COUNT(*) FROM transactions WHERE created_at > NOW() - INTERVAL '1 hour') as transactions;
-- transactions should be ~2x purchases

-- Check idempotency keys exist
SELECT COUNT(*) FROM purchases
WHERE idempotency_key IS NOT NULL
AND created_at > NOW() - INTERVAL '1 hour';
-- Should be > 0 for new purchases

-- Check no duplicate purchases
SELECT post_id, user_id, COUNT(*)
FROM purchases
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY post_id, user_id
HAVING COUNT(*) > 1;
-- Should return 0 rows
```

---

## Monitoring (First 24 Hours)

### 1. Error Monitoring

- [ ] **Supabase Logs**: Check for RPC errors
  - Dashboard → Logs → Filter: `unlock_ppv`
  - Look for: "Transaction failed", "Insufficient balance"
- [ ] **Application Logs**: Check API errors
  - Look for: 500 errors on `/api/unlock`
- [ ] **Browser Console**: Check client errors
  - Test on multiple browsers
  - Check for JavaScript errors

### 2. Metrics to Track

```sql
-- Hourly unlock success rate
SELECT
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) FILTER (WHERE status = 'completed') as successful,
  COUNT(*) as total,
  ROUND(COUNT(*) FILTER (WHERE status = 'completed') * 100.0 / COUNT(*), 2) as success_rate
FROM purchases
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour DESC;

-- Insufficient balance errors (check logs)
-- Average unlock time (check logs)
-- Idempotency key usage rate
SELECT
  COUNT(*) FILTER (WHERE idempotency_key IS NOT NULL) * 100.0 / COUNT(*) as idempotency_usage_pct
FROM purchases
WHERE created_at > NOW() - INTERVAL '24 hours';
```

### 3. User Feedback

- [ ] Monitor support tickets for unlock issues
- [ ] Check for complaints about double charges
- [ ] Watch for "insufficient balance" confusion

---

## Rollback Plan (If Needed)

### If Critical Issue Found:

1. **Immediate**: Disable unlock feature in UI

   ```typescript
   // In paywall-modal.tsx, temporarily disable button
   disabled={true}
   ```

2. **Database Rollback**:

   ```sql
   -- Run migrations/024_rollback.sql
   -- This removes new columns/functions but keeps data
   ```

3. **Code Rollback**:
   - Revert to previous commit
   - Redeploy

4. **Restore old RPC** (if you had one):
   ```sql
   -- Restore rpc_purchase_post function from backup
   ```

---

## Success Criteria

✅ **MVP is successful if**:

- [ ] 95%+ unlock success rate
- [ ] 0 double charge incidents
- [ ] Purchase-transaction consistency 100%
- [ ] No critical bugs in first 24 hours
- [ ] User can unlock content without page refresh
- [ ] Insufficient balance handled gracefully

---

## Contacts

- **Database Issues**: Check Supabase Dashboard
- **Code Issues**: Review `MVP_MONETIZATION_DELIVERY.md`
- **Migration Issues**: Review `MIGRATION_QUICK_FIX.md`

---

## Next Sprint (Post-P0)

After successful deployment:

- [ ] Add refund flow
- [ ] Add creator payout flow
- [ ] Optimize RPC performance
- [ ] Add analytics dashboard
- [ ] Implement webhook notifications

---

**Last Updated**: 2026-01-18
**Status**: Ready for Production ✅
