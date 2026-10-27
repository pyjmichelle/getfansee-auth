-- KYC decisions and temporary bans must never be browser-writable.
REVOKE INSERT, UPDATE, DELETE ON public.creator_verifications FROM anon, authenticated;
DROP POLICY IF EXISTS creator_verifications_insert_own ON public.creator_verifications;

CREATE OR REPLACE FUNCTION public.protect_profile_privileged_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_key text;
  v_protected_keys constant text[] := ARRAY[
    'id', 'email', 'role', 'age_verified', 'is_banned', 'ban_until', 'is_verified',
    'commission_free_until', 'kyc_provider', 'kyc_session_id',
    'kyc_verification_url', 'kyc_external_status', 'kyc_started_at',
    'kyc_submitted_at', 'kyc_decided_at', 'kyc_last_error', 'kyc_country',
    'kyc_age_verified', 'kyc_raw_payload'
  ];
BEGIN
  IF current_user NOT IN ('postgres', 'service_role', 'supabase_admin') THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.id IS DISTINCT FROM auth.uid()
         OR NEW.role IS DISTINCT FROM 'fan'
         OR COALESCE(NEW.age_verified, false)
         OR COALESCE(NEW.is_banned, false)
         OR (to_jsonb(NEW)->>'ban_until') IS NOT NULL
         OR COALESCE(NEW.is_verified, false)
         OR NEW.commission_free_until IS NOT NULL
         OR NEW.kyc_session_id IS NOT NULL
         OR NEW.kyc_external_status IS NOT NULL
         OR COALESCE(NEW.kyc_age_verified, false)
         OR NEW.kyc_raw_payload IS NOT NULL THEN
        RAISE EXCEPTION 'privileged profile fields cannot be set by the current user'
          USING ERRCODE = '42501';
      END IF;
      RETURN NEW;
    END IF;

    FOREACH v_key IN ARRAY v_protected_keys LOOP
      IF (to_jsonb(NEW) -> v_key) IS DISTINCT FROM (to_jsonb(OLD) -> v_key) THEN
        RAISE EXCEPTION 'profile field % cannot be changed by the current user', v_key
          USING ERRCODE = '42501';
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_privileged_fields ON public.profiles;
CREATE TRIGGER protect_profile_privileged_fields
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_privileged_fields();


CREATE OR REPLACE FUNCTION public.protect_post_moderation_fields()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user NOT IN ('postgres', 'service_role', 'supabase_admin') THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.review_status IS DISTINCT FROM 'pending' OR NEW.reviewed_by IS NOT NULL
         OR NEW.reviewed_at IS NOT NULL OR NEW.rejection_reason IS NOT NULL THEN
        RAISE EXCEPTION 'moderation decisions require the server' USING ERRCODE = '42501';
      END IF;
    ELSIF NEW.review_status IS DISTINCT FROM OLD.review_status
       OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
       OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
       OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason THEN
      RAISE EXCEPTION 'moderation decisions require the server' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS protect_post_moderation_fields ON public.posts;
CREATE TRIGGER protect_post_moderation_fields BEFORE INSERT OR UPDATE ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.protect_post_moderation_fields();
REVOKE ALL ON FUNCTION public.protect_post_moderation_fields() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.protect_post_moderation_fields() TO service_role;

-- A cancellation never forfeits an already purchased, unexpired access period.
DROP POLICY IF EXISTS posts_select_visible ON public.posts;
CREATE POLICY posts_select_visible ON public.posts FOR SELECT USING (
  creator_id = auth.uid() OR (
    deleted_at IS NULL AND review_status = 'approved' AND (
      visibility = 'free' OR (
        visibility = 'subscribers' AND EXISTS (
          SELECT 1 FROM public.subscriptions s WHERE s.subscriber_id = auth.uid()
            AND s.creator_id = posts.creator_id AND s.status IN ('active', 'canceled')
            AND s.current_period_end > now()
        )
      ) OR (
        visibility = 'ppv' AND EXISTS (
          SELECT 1 FROM public.purchases p WHERE p.fan_id = auth.uid() AND p.post_id = posts.id
        )
      )
    )
  )
);
