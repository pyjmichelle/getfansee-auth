# Migration 024 Quick Fix Guide

## Error: duplicate key value violates unique constraint "profiles_username_key"

### Problem

The migration tried to add a UNIQUE constraint on `username` but found duplicate values.

### Solution

Use the **SAFE** migration version which handles duplicates automatically.

---

## Step-by-Step Fix

### Option 1: Use Safe Migration (Recommended)

1. **If migration already partially ran, rollback first**:

   ```sql
   -- In Supabase SQL Editor, run:
   -- Copy/paste from migrations/024_rollback.sql

   DROP FUNCTION IF EXISTS public.unlock_ppv(UUID, UUID, TEXT);
   ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_username_key;
   DROP INDEX IF EXISTS public.idx_profiles_username;
   DROP INDEX IF EXISTS public.idx_purchases_idempotency_key;
   ALTER TABLE public.purchases DROP COLUMN IF EXISTS idempotency_key;
   -- Keep username column, just remove constraint
   ```

2. **Run the safe migration**:

   ```sql
   -- Copy/paste entire content from:
   -- migrations/024_atomic_unlock_ppv_safe.sql
   ```

3. **Verify**:

   ```sql
   -- Check function exists
   SELECT proname FROM pg_proc WHERE proname = 'unlock_ppv';

   -- Check columns exist
   SELECT column_name FROM information_schema.columns
   WHERE table_name = 'profiles' AND column_name = 'username';

   SELECT column_name FROM information_schema.columns
   WHERE table_name = 'purchases' AND column_name = 'idempotency_key';

   -- Check for duplicate usernames (should be 0)
   SELECT username, COUNT(*)
   FROM profiles
   GROUP BY username
   HAVING COUNT(*) > 1;
   ```

---

### Option 2: Manual Fix (If you want to keep existing usernames)

1. **Find duplicates**:

   ```sql
   SELECT username, COUNT(*), ARRAY_AGG(id) as profile_ids
   FROM public.profiles
   WHERE username IS NOT NULL
   GROUP BY username
   HAVING COUNT(*) > 1;
   ```

2. **Fix duplicates manually**:

   ```sql
   -- For each duplicate, update to make unique
   UPDATE public.profiles
   SET username = username || '_' || SUBSTRING(id::text FROM 1 FOR 8)
   WHERE id = '<duplicate-profile-id>';
   ```

3. **Add unique constraint**:

   ```sql
   ALTER TABLE public.profiles
   ADD CONSTRAINT profiles_username_key UNIQUE (username);
   ```

4. **Continue with rest of migration**:
   ```sql
   -- Copy remaining parts from 024_atomic_unlock_ppv_safe.sql
   -- (idempotency_key and unlock_ppv function)
   ```

---

## Prevention

Always run **pre-check** before migration:

```sql
-- Copy/paste from migrations/024_pre_check.sql
-- This will show you potential issues BEFORE running migration
```

---

## Verification After Fix

```sql
-- 1. Check username uniqueness
SELECT
  COUNT(*) as total_profiles,
  COUNT(DISTINCT username) as unique_usernames
FROM public.profiles;
-- Should be equal

-- 2. Check function works
SELECT public.unlock_ppv(
  '<test-post-id>'::uuid,
  '<test-user-id>'::uuid,
  'test_key_123'
);
-- Should return JSON with success/error

-- 3. Check indexes
SELECT indexname FROM pg_indexes
WHERE tablename IN ('profiles', 'purchases')
AND indexname LIKE '%username%' OR indexname LIKE '%idempotency%';
```

---

## Common Issues

### Issue: "column username already exists"

**Solution**: The safe migration handles this. Just run it.

### Issue: "constraint already exists"

**Solution**: The safe migration handles this. Just run it.

### Issue: "function already exists"

**Solution**: Safe migration uses `CREATE OR REPLACE`. Just run it.

### Issue: Still getting duplicate key error

**Solution**:

1. Run rollback script
2. Manually fix duplicates (Option 2 above)
3. Run safe migration

---

## Need Help?

1. Check `024_pre_check.sql` output
2. Review `024_rollback.sql` to understand what can be undone
3. Safe migration (`024_atomic_unlock_ppv_safe.sql`) is idempotent - safe to run multiple times
