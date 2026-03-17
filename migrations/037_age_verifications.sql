-- Migration: 037_age_verifications
-- Purpose: Create age_verifications table to log age gate confirmations for compliance.
-- This provides an audit trail required by payment processors and regulators.

CREATE TABLE IF NOT EXISTS age_verifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  text,                          -- anonymous browser fingerprint (not PII)
  ip_address  text,                          -- IP at time of verification (hashed by API layer)
  user_agent  text,
  verified_at timestamptz NOT NULL DEFAULT now()
);

-- Retention: auto-delete entries older than 2 years (GDPR principle of storage limitation)
CREATE OR REPLACE FUNCTION cleanup_old_age_verifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM age_verifications WHERE verified_at < now() - interval '2 years';
END;
$$;

-- RLS: Only service role can read/write (no user-facing access needed)
ALTER TABLE age_verifications ENABLE ROW LEVEL SECURITY;

-- No SELECT policy for authenticated users — this is internal audit data only.
-- The insert is done via service role (API route with admin client).

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_age_verifications_verified_at ON age_verifications (verified_at);
