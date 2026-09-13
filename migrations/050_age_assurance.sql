-- Migration 050: Age assurance evidence log
--
-- Companion to the signed cookie in lib/compliance/assurance-token.ts. The
-- cookie is the *gate* (stateless, verifiable in Edge middleware with no DB
-- round trip); this table is the *evidence* an auditor or regulator reads.
--
-- Deliberately stores NO personally identifying information:
--   - no name, date of birth, document number or document image
--   - no raw IP (SHA-256 hash only, mirroring migration 037)
--   - the identity document, if one was used, is held and deleted by the
--     verification vendor; we retain only "which method, when, what result"
--
-- Several US state statutes prohibit retaining PII after access is granted, so
-- the safe design is to never receive it. What we do retain is what an
-- affirmative-defence argument actually needs: that a check of an enumerated
-- method was performed, when, from where, and that it passed.
--
-- Distinct from `age_verifications` (037), which logs self-attestation clicks
-- for low-risk jurisdictions. That table stays as-is for Tier A.

CREATE TABLE IF NOT EXISTS public.age_assurance_checks (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Null for anonymous visitors: adult content is browsable without an
  -- account, so the gate must work before there is a user to attach to.
  user_id             uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- What the visitor's jurisdiction demanded vs. what was actually performed.
  -- A stronger method than required is normal (Florida offers facial
  -- estimation as the anonymous option but permits document as well).
  required_tier       text NOT NULL CHECK (required_tier IN ('self_attest', 'age_estimation', 'document')),
  method              text NOT NULL CHECK (method IN ('self_attest', 'age_estimation', 'document', 'database')),

  status              text NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'passed', 'failed', 'abandoned', 'expired')),

  provider            text,
  provider_session_id text,

  -- Jurisdiction at the time of the check, for audit and travel detection.
  country             text,
  region              text,

  ip_hash             text,
  user_agent          text,

  verified_at         timestamptz,
  expires_at          timestamptz,

  created_at          timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at          timestamptz NOT NULL DEFAULT timezone('utc', now())
);

COMMENT ON TABLE public.age_assurance_checks IS
  'Age assurance audit trail. Contains no PII and no document data by design.';

-- One row per vendor session: the callback and the webhook can both land for
-- the same session, and neither may create a second evidence record.
CREATE UNIQUE INDEX IF NOT EXISTS uq_age_assurance_provider_session
  ON public.age_assurance_checks (provider, provider_session_id)
  WHERE provider_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_age_assurance_user
  ON public.age_assurance_checks (user_id, verified_at DESC)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_age_assurance_created
  ON public.age_assurance_checks (created_at);

-- Internal audit data only. No policies are defined, so `authenticated` and
-- `anon` have no access at all; every read/write goes through the service role.
ALTER TABLE public.age_assurance_checks ENABLE ROW LEVEL SECURITY;

-- Storage limitation: two years is long enough to answer a regulator about a
-- past access decision and short enough to satisfy GDPR minimisation. Nothing
-- here identifies a person, so there is no benefit to keeping it longer.
CREATE OR REPLACE FUNCTION public.cleanup_old_age_assurance_checks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.age_assurance_checks
  WHERE created_at < timezone('utc', now()) - interval '2 years';
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_old_age_assurance_checks() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_old_age_assurance_checks() TO service_role;

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration 050 Verification:';
  RAISE NOTICE 'age_assurance_checks exists: %', (
    SELECT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'age_assurance_checks')
  );
  RAISE NOTICE 'RLS enabled: %', (
    SELECT relrowsecurity FROM pg_class WHERE relname = 'age_assurance_checks'
  );
  RAISE NOTICE '========================================';
END $$;
