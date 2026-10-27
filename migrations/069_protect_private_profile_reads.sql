-- Generated with Supabase CLI; retained in the numbered migration stream.
-- Permissive SELECT policies combine with OR: a false anonymous policy cannot
-- cancel legacy creator-wide reads. Raw profiles are private owner records.
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public'
    AND tablename='profiles' AND cmd IN ('SELECT','ALL') LOOP
    EXECUTE format('DROP POLICY %I ON public.profiles',p.policyname);
  END LOOP;
END; $$;
CREATE POLICY profiles_select_private_own ON public.profiles
  FOR SELECT TO authenticated USING (id=auth.uid());
REVOKE SELECT ON public.profiles FROM anon;
GRANT SELECT ON public.profiles TO authenticated,service_role;

CREATE OR REPLACE VIEW public.public_creator_profiles WITH (security_barrier=true) AS
  SELECT id,display_name,avatar_url,bio,role,blocked_countries,is_verified,
    is_founding_creator,category,created_at,username,subscription_price_cents
  FROM public.profiles WHERE role='creator' AND NOT COALESCE(is_banned,false);
GRANT SELECT ON public.public_creator_profiles TO anon,authenticated;

-- Only public creator labels, the caller's own label and that caller's
-- subscribers' labels. No general fan directory, email, or private fields.
CREATE VIEW public.public_profile_labels WITH (security_barrier=true) AS
  SELECT p.id,p.display_name,p.avatar_url FROM public.profiles p
  WHERE NOT COALESCE(p.is_banned,false) AND (
    p.role='creator' OR p.id=auth.uid() OR EXISTS(
      SELECT 1 FROM public.subscriptions s
      WHERE s.creator_id=auth.uid() AND s.subscriber_id=p.id
    )
  );
REVOKE ALL ON public.public_profile_labels FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.public_profile_labels TO authenticated,service_role;

-- Optional historical KYC profile fields are not present in every deployment.
-- JSON lookups keep valid browser signup working without trusting such fields.
CREATE OR REPLACE FUNCTION public.protect_profile_privileged_fields()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE v_key text;
  v_keys constant text[] := ARRAY['id','email','role','age_verified','is_banned','ban_until',
   'is_verified','commission_free_until','kyc_provider','kyc_session_id','kyc_verification_url',
   'kyc_external_status','kyc_started_at','kyc_submitted_at','kyc_decided_at','kyc_last_error',
   'kyc_country','kyc_age_verified','kyc_raw_payload'];
BEGIN
 IF current_user NOT IN ('postgres','service_role','supabase_admin') THEN
  IF TG_OP='INSERT' THEN
   IF NEW.id IS DISTINCT FROM auth.uid() OR NEW.role IS DISTINCT FROM 'fan'
    OR COALESCE((to_jsonb(NEW)->>'age_verified')::boolean,false)
    OR COALESCE((to_jsonb(NEW)->>'is_banned')::boolean,false)
    OR COALESCE((to_jsonb(NEW)->>'is_verified')::boolean,false)
    OR COALESCE((to_jsonb(NEW)->>'kyc_age_verified')::boolean,false)
    OR to_jsonb(NEW)->>'ban_until' IS NOT NULL
    OR to_jsonb(NEW)->>'commission_free_until' IS NOT NULL
    OR to_jsonb(NEW)->>'kyc_session_id' IS NOT NULL
    OR to_jsonb(NEW)->>'kyc_external_status' IS NOT NULL
    OR to_jsonb(NEW)->>'kyc_raw_payload' IS NOT NULL THEN
     RAISE EXCEPTION 'Privileged profile fields require the server' USING ERRCODE='42501';
   END IF;
  ELSE
   FOREACH v_key IN ARRAY v_keys LOOP
    IF to_jsonb(NEW)->v_key IS DISTINCT FROM to_jsonb(OLD)->v_key THEN
      RAISE EXCEPTION 'Profile field % requires the server',v_key USING ERRCODE='42501';
    END IF;
   END LOOP;
  END IF;
 END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.protect_profile_privileged_fields() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.protect_profile_privileged_fields() TO service_role;

-- Comments follow the same paid/moderation entitlement as their parent post.
DO $$ DECLARE p record; BEGIN
 FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public'
  AND tablename='post_comments' AND cmd IN ('SELECT','INSERT','ALL') LOOP
  EXECUTE format('DROP POLICY %I ON public.post_comments',p.policyname);
 END LOOP;
END; $$;
CREATE POLICY post_comments_select_entitled ON public.post_comments FOR SELECT TO authenticated
 USING (EXISTS(SELECT 1 FROM public.posts p WHERE p.id=post_id));
CREATE POLICY post_comments_insert_entitled_own ON public.post_comments FOR INSERT TO authenticated
 WITH CHECK(user_id=auth.uid() AND EXISTS(SELECT 1 FROM public.posts p WHERE p.id=post_id));
