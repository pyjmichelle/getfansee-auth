-- Execute only on the dedicated isolated test project. Every fixture and change
-- is rolled back; this exercises database behavior, not HTTP/provider delivery.
BEGIN;
CREATE TEMP TABLE qa_stage_context ON COMMIT DROP AS
  SELECT gen_random_uuid() AS fan, gen_random_uuid() AS creator, gen_random_uuid() AS post, gen_random_uuid() AS newcomer;
GRANT SELECT ON qa_stage_context TO authenticated, anon;
INSERT INTO auth.users(id,email,raw_app_meta_data)
  SELECT fan, 'e2e+smoke-fan-'||fan::text||'@example.test', '{"getfansee_test_fixture":true}'::jsonb FROM qa_stage_context
  UNION ALL
  SELECT creator, 'e2e+smoke-creator-'||creator::text||'@example.test', '{"getfansee_test_fixture":true}'::jsonb FROM qa_stage_context
  UNION ALL
  SELECT newcomer, 'e2e+smoke-new-'||newcomer::text||'@example.test', '{"getfansee_test_fixture":true}'::jsonb FROM qa_stage_context;
INSERT INTO public.profiles(id,email,display_name,username,role,is_verified,subscription_price_cents)
  SELECT fan,'e2e+smoke-fan-'||fan::text||'@example.test','QA fan','qa_'||replace(fan::text,'-',''),'fan',false,0 FROM qa_stage_context
  UNION ALL
  SELECT creator,'e2e+smoke-creator-'||creator::text||'@example.test','QA creator','qa_'||replace(creator::text,'-',''),'creator',true,1200 FROM qa_stage_context;
INSERT INTO public.posts(id,creator_id,title,content,visibility,review_status)
  SELECT post,creator,'Isolated subscription test','Temporary test content','subscribers','approved' FROM qa_stage_context;
DO $$ DECLARE c record; r json; BEGIN
  SELECT * INTO c FROM qa_stage_context;
  SELECT public.recharge_wallet(c.fan,5000,'qa_'||c.fan::text) INTO r;
  IF (r->>'success')::boolean IS DISTINCT FROM true THEN RAISE EXCEPTION 'Mock funding failed'; END IF;
  SELECT public.spend_wallet_on_subscription(c.fan,c.creator,1,0,'qa_sub_'||c.fan::text,30,NULL,NULL,now()) INTO r;
  IF (r->>'success')::boolean IS DISTINCT FROM true OR (r->>'gross_amount_cents')::integer<>1200 THEN
    RAISE EXCEPTION 'Authoritative subscription purchase failed'; END IF;
  IF (SELECT available_balance_cents FROM public.wallet_accounts WHERE user_id=c.fan)<>3800 THEN
    RAISE EXCEPTION 'Funded debit mismatch'; END IF;
  IF EXISTS(SELECT 1 FROM public.wallet_accounts WHERE user_id=c.creator AND available_balance_cents<>0) THEN
    RAISE EXCEPTION 'Earnings leaked into spending wallet'; END IF;
END; $$;
INSERT INTO public.post_comments(post_id,user_id,content)
  SELECT post,fan,'Temporary paid comment' FROM qa_stage_context;
SELECT set_config('request.jwt.claim.sub',(SELECT newcomer::text FROM qa_stage_context),true);
SET LOCAL ROLE authenticated;
INSERT INTO public.profiles(id,email,username)
  SELECT newcomer,'e2e+smoke-new-'||newcomer::text||'@example.test','qa_'||replace(newcomer::text,'-','') FROM qa_stage_context;
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM public.post_comments WHERE post_id=(SELECT post FROM qa_stage_context)) THEN
    RAISE EXCEPTION 'Unpaid user can read paid comments'; END IF;
  IF EXISTS(SELECT 1 FROM public.profiles WHERE id=(SELECT creator FROM qa_stage_context)) THEN
    RAISE EXCEPTION 'Nonowner can read private creator profile'; END IF;
END; $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',(SELECT fan::text FROM qa_stage_context),true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE c record; changed integer; r jsonb; BEGIN
  SELECT * INTO c FROM qa_stage_context;
  UPDATE public.profiles SET display_name='QA edited fan' WHERE id=c.fan;
  GET DIAGNOSTICS changed=ROW_COUNT;
  IF changed<>1 THEN RAISE EXCEPTION 'Owner profile edit failed'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.posts WHERE id=c.post) THEN RAISE EXCEPTION 'Paid fan cannot read subscribed post'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.post_comments WHERE post_id=c.post) THEN RAISE EXCEPTION 'Paid fan cannot read paid comments'; END IF;
  BEGIN
    INSERT INTO public.post_comments(post_id,user_id,content) VALUES(c.post,c.creator,'Forged author');
    RAISE EXCEPTION 'Comment author forgery allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  SELECT public.rpc_get_wallet_balance(c.creator) INTO r;
  IF (r->>'success')::boolean IS DISTINCT FROM false THEN RAISE EXCEPTION 'Cross-user wallet read allowed'; END IF;
  BEGIN
    UPDATE public.profiles SET role='admin' WHERE id=c.fan;
    RAISE EXCEPTION 'Browser role promotion allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    INSERT INTO public.creator_verifications(user_id,status) VALUES(c.fan,'approved');
    RAISE EXCEPTION 'Browser KYC approval allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  UPDATE public.wallet_accounts SET available_balance_cents=999999 WHERE user_id=c.fan;
  GET DIAGNOSTICS changed=ROW_COUNT;
  IF changed<>0 THEN RAISE EXCEPTION 'Browser balance mutation allowed'; END IF;
  UPDATE public.subscriptions SET current_period_end=now()+interval '365 days' WHERE subscriber_id=c.fan;
  GET DIAGNOSTICS changed=ROW_COUNT;
  IF changed<>0 THEN RAISE EXCEPTION 'Browser subscription extension allowed'; END IF;
END; $$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $$ BEGIN
  BEGIN
    PERFORM email FROM public.profiles;
    RAISE EXCEPTION 'Anonymous private profile read allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  IF NOT EXISTS(SELECT 1 FROM public.public_creator_profiles WHERE id=(SELECT creator FROM qa_stage_context)) THEN
    RAISE EXCEPTION 'Public creator projection failed'; END IF;
  BEGIN
    PERFORM email FROM public.public_creator_profiles;
    RAISE EXCEPTION 'Private email exposed by creator projection';
  EXCEPTION WHEN undefined_column THEN NULL; END;
END; $$;
RESET ROLE;
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM public.reconciliation_report() WHERE difference<>0) THEN
    RAISE EXCEPTION 'Financial reconciliation failed'; END IF;
END; $$;
ROLLBACK;
SELECT 'PASS: hosted database subscription, RLS and reconciliation checks; fixtures rolled back' AS result;
