-- 060_preserve_financial_history.sql
-- Financial records must survive account deletion. A user with monetary
-- history must be archived/anonymised through an explicit workflow instead of
-- being deleted through auth.users and silently erasing the audit trail.

DO $$
DECLARE
  v_target record;
  v_constraint record;
BEGIN
  FOR v_target IN
    SELECT *
    FROM (VALUES
      ('transactions', 'user_id'),
      ('payment_orders', 'user_id'),
      ('consumption_orders', 'fan_id'),
      ('consumption_orders', 'creator_id'),
      ('creator_ledger', 'creator_id'),
      ('withdrawal_requests', 'creator_id'),
      ('tips', 'fan_id'),
      ('tips', 'creator_id'),
      ('purchases', 'fan_id')
    ) AS targets(table_name, column_name)
  LOOP
    IF to_regclass(format('public.%I', v_target.table_name)) IS NULL THEN
      CONTINUE;
    END IF;

    SELECT c.conname, c.confdeltype
      INTO v_constraint
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_attribute a
      ON a.attrelid = t.oid
     AND a.attnum = ANY (c.conkey)
    JOIN pg_class rt ON rt.oid = c.confrelid
    JOIN pg_namespace rn ON rn.oid = rt.relnamespace
    WHERE c.contype = 'f'
      AND n.nspname = 'public'
      AND t.relname = v_target.table_name
      AND a.attname = v_target.column_name
      AND rn.nspname = 'auth'
      AND rt.relname = 'users'
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Missing auth.users FK: %.%', v_target.table_name, v_target.column_name;
    END IF;

    IF v_constraint.confdeltype <> 'r' THEN
      EXECUTE format(
        'ALTER TABLE public.%I DROP CONSTRAINT %I',
        v_target.table_name,
        v_constraint.conname
      );
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES auth.users(id) ON DELETE RESTRICT',
        v_target.table_name,
        v_constraint.conname,
        v_target.column_name
      );
    END IF;
  END LOOP;
END;
$$;

COMMENT ON TABLE public.transactions IS
  'Financial event history. User references are deletion-restricted; archive/anonymise users instead.';
