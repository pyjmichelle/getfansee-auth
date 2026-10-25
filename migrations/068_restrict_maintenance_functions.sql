-- Generated with Supabase CLI; retained in the numbered migration stream.
-- Trigger callbacks and retention jobs are not browser RPC endpoints.
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT oid::regprocedure AS signature FROM pg_proc
    WHERE pronamespace='public'::regnamespace
      AND (prorettype='trigger'::regtype OR proname IN (
        'cleanup_old_age_assurance_checks','cleanup_old_age_verifications','cleanup_old_webhook_events'))
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',p.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',p.signature);
  END LOOP;
  FOR p IN SELECT oid::regprocedure AS signature FROM pg_proc
    WHERE pronamespace='public'::regnamespace AND proname IN (
      'set_updated_at','set_kyc_sessions_updated_at','cleanup_old_webhook_events',
      'generate_purchase_idempotency_key','cleanup_old_age_verifications',
      'normalize_payram_asset','normalize_payram_network')
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path=public,pg_temp',p.signature);
  END LOOP;
END; $$;
