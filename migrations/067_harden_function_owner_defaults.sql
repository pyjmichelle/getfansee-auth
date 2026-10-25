-- Generated with Supabase CLI; retained in the numbered migration stream.
-- Schema defaults only ADD to global defaults. A schema-only PUBLIC revoke
-- cannot remove PostgreSQL's built-in global PUBLIC EXECUTE default.
-- Change only this application's migration owner, never Supabase-managed roles.
DO $$ DECLARE v_owner oid; BEGIN
  SELECT proowner INTO v_owner FROM pg_proc WHERE oid =
    to_regprocedure('public.spend_wallet(uuid,uuid,text,bigint,integer,text,text,uuid,text,text,timestamptz)');
  IF v_owner IS NULL OR v_owner IS DISTINCT FROM current_user::regrole::oid THEN
    RAISE EXCEPTION 'Function-default migration must run as the application function owner';
  END IF;
END; $$;
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO service_role;
