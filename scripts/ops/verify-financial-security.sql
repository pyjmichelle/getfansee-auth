\set ON_ERROR_STOP on

DO $$
DECLARE
  v_proc record;
  v_bad_fk record;
  v_restrictive_fk_count integer;
BEGIN
  IF to_regclass('public.wallet_account_split_audit') IS NULL THEN
    RAISE EXCEPTION 'funded/earned split is not applied; requires migration 065';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace='public'::regnamespace
              AND proname='rpc_get_wallet_balance' AND prosecdef) THEN
    RAISE EXCEPTION 'wallet read helper still bypasses caller RLS';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace='public'::regnamespace
              AND proname IN ('unlock_ppv','rpc_purchase_post')
              AND has_function_privilege('service_role',oid,'EXECUTE')) THEN
    RAISE EXCEPTION 'obsolete purchase writers are still callable';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.wallet_accounts'::regclass
                 AND conname='funded_balance_nonnegative' AND convalidated)
     OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.wallet_accounts'::regclass
                 AND conname='funded_wallet_has_no_earned_pending' AND convalidated) THEN
    RAISE EXCEPTION 'funded-wallet separation constraints are missing';
  END IF;
  IF has_table_privilege('authenticated', 'public.creator_verifications', 'INSERT')
     OR has_table_privilege('authenticated', 'public.creator_verifications', 'UPDATE')
     OR has_table_privilege('anon', 'public.creator_verifications', 'INSERT') THEN
    RAISE EXCEPTION 'KYC decisions remain browser-writable; apply migration 062';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.posts'::regclass
      AND tgname = 'protect_post_moderation_fields' AND tgenabled <> 'D'
  ) THEN
    RAISE EXCEPTION 'post moderation-field protection is missing';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'wallet_accounts'
      AND policyname = 'wallet_accounts_update_own'
  ) THEN
    RAISE EXCEPTION 'wallet_accounts_update_own still exists';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger tr
    JOIN pg_class t ON t.oid = tr.tgrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'profiles'
      AND tr.tgname = 'protect_profile_privileged_fields'
      AND NOT tr.tgisinternal
      AND tr.tgenabled <> 'D'
  ) THEN
    RAISE EXCEPTION 'profile privileged-field trigger is missing or disabled';
  END IF;

  FOR v_proc IN
    SELECT p.oid, p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY (ARRAY[
        'open_payment_order', 'credit_payram_deposit',
        'credit_nowpayments_deposit', 'spend_wallet',
        'spend_wallet_on_ppv', 'spend_wallet_on_tip',
        'spend_wallet_on_subscription', 'settle_matured_earnings',
        'reverse_consumption_order', 'refund_unspent_balance',
        'reconciliation_report', 'revenue_report', 'nexus_report',
        'increment_wallet_available', 'request_withdrawal',
        'decide_withdrawal', 'creator_earned_balances', 'recharge_wallet', 'unlock_ppv',
        'rpc_purchase_post'
      ])
  LOOP
    IF has_function_privilege('anon', v_proc.oid, 'EXECUTE')
       OR has_function_privilege('authenticated', v_proc.oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'financial RPC remains browser-callable: %', v_proc.signature;
    END IF;
  END LOOP;

  SELECT t.relname AS table_name, a.attname AS column_name, c.confdeltype
    INTO v_bad_fk
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY (c.conkey)
  JOIN pg_class rt ON rt.oid = c.confrelid
  JOIN pg_namespace rn ON rn.oid = rt.relnamespace
  WHERE c.contype = 'f'
    AND n.nspname = 'public'
    AND rn.nspname = 'auth'
    AND rt.relname = 'users'
    AND (t.relname, a.attname) IN (
      ('transactions', 'user_id'),
      ('payment_orders', 'user_id'),
      ('consumption_orders', 'fan_id'),
      ('consumption_orders', 'creator_id'),
      ('creator_ledger', 'creator_id'),
      ('withdrawal_requests', 'creator_id'),
      ('tips', 'fan_id'),
      ('tips', 'creator_id'),
      ('purchases', 'fan_id')
    )
    AND c.confdeltype <> 'r'
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'financial FK is not deletion-restricted: %.%',
      v_bad_fk.table_name, v_bad_fk.column_name;
  END IF;

  SELECT count(*)
    INTO v_restrictive_fk_count
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY (c.conkey)
  JOIN pg_class rt ON rt.oid = c.confrelid
  JOIN pg_namespace rn ON rn.oid = rt.relnamespace
  WHERE c.contype = 'f'
    AND n.nspname = 'public'
    AND rn.nspname = 'auth'
    AND rt.relname = 'users'
    AND c.confdeltype = 'r'
    AND (t.relname, a.attname) IN (
      ('transactions', 'user_id'),
      ('payment_orders', 'user_id'),
      ('consumption_orders', 'fan_id'),
      ('consumption_orders', 'creator_id'),
      ('creator_ledger', 'creator_id'),
      ('withdrawal_requests', 'creator_id'),
      ('tips', 'fan_id'),
      ('tips', 'creator_id'),
      ('purchases', 'fan_id')
    );

  IF v_restrictive_fk_count <> 9 THEN
    RAISE EXCEPTION 'expected 9 deletion-restricted financial FKs, found %',
      v_restrictive_fk_count;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_default_acl d
    JOIN pg_namespace n ON n.oid = d.defaclnamespace
    WHERE n.nspname = 'public'
      AND d.defaclobjtype = 'f'
  ) THEN
    RAISE EXCEPTION 'no hardened default function ACL exists for public schema';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_default_acl d
    JOIN pg_namespace n ON n.oid = d.defaclnamespace
    CROSS JOIN LATERAL aclexplode(d.defaclacl) acl
    LEFT JOIN pg_roles r ON r.oid = acl.grantee
    WHERE n.nspname = 'public'
      AND d.defaclobjtype = 'f'
      AND acl.privilege_type = 'EXECUTE'
      AND (acl.grantee = 0 OR r.rolname IN ('anon', 'authenticated'))
  ) THEN
    RAISE EXCEPTION 'future public-schema functions still default to browser-callable EXECUTE';
  END IF;
END;
$$;

SELECT 'OK: live financial security posture verified' AS result;
