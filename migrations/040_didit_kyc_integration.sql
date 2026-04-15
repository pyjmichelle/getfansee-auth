-- Migration 040: Didit KYC Integration
-- Extends creator_verifications for Didit hosted sessions,
-- adds kyc_events audit table and kyc_sessions tracking table.

BEGIN;

-- 1. Expand creator_verifications status constraint for Didit statuses
ALTER TABLE creator_verifications
  DROP CONSTRAINT IF EXISTS creator_verifications_status_check;

ALTER TABLE creator_verifications
  ADD CONSTRAINT creator_verifications_status_check
  CHECK (status IN (
    'not_started', 'initiated', 'in_progress', 'submitted',
    'approved', 'declined', 'expired', 'resubmission_required', 'error',
    'pending', 'rejected'
  ));

-- 2. Add Didit integration columns to creator_verifications
ALTER TABLE creator_verifications
  ADD COLUMN IF NOT EXISTS kyc_provider text NOT NULL DEFAULT 'didit',
  ADD COLUMN IF NOT EXISTS kyc_session_id text,
  ADD COLUMN IF NOT EXISTS kyc_verification_url text,
  ADD COLUMN IF NOT EXISTS kyc_external_status text,
  ADD COLUMN IF NOT EXISTS kyc_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS kyc_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS kyc_decided_at timestamptz,
  ADD COLUMN IF NOT EXISTS kyc_last_error text,
  ADD COLUMN IF NOT EXISTS kyc_country text,
  ADD COLUMN IF NOT EXISTS kyc_age_verified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS kyc_raw_payload jsonb;

-- 3. Migrate legacy status values
UPDATE creator_verifications SET status = 'approved' WHERE status = 'pending' AND reviewed_at IS NOT NULL AND rejection_reason IS NULL;
-- Keep 'pending' and 'rejected' as-is; they are in the new constraint

-- 4. Create kyc_events audit table
CREATE TABLE IF NOT EXISTS public.kyc_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'didit',
  event_type text NOT NULL,
  external_session_id text,
  internal_status_before text,
  internal_status_after text,
  payload_json jsonb,
  error_message text,
  processed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kyc_events_user_id ON kyc_events(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_events_session_id ON kyc_events(external_session_id);

-- 5. Create kyc_sessions table for tracking Didit sessions
CREATE TABLE IF NOT EXISTS public.kyc_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'didit',
  external_session_id text NOT NULL,
  workflow_id text,
  verification_url text,
  session_token text,
  status text NOT NULL DEFAULT 'not_started',
  vendor_data text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expired_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_kyc_sessions_user_id ON kyc_sessions(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_kyc_sessions_external ON kyc_sessions(external_session_id);

-- 6. RLS for kyc_events (service role only writes, users can read own)
ALTER TABLE kyc_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own kyc_events"
  ON kyc_events FOR SELECT
  USING (auth.uid() = user_id);

-- 7. RLS for kyc_sessions (users can read own)
ALTER TABLE kyc_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own kyc_sessions"
  ON kyc_sessions FOR SELECT
  USING (auth.uid() = user_id);

-- 8. Auto-update updated_at on kyc_sessions
CREATE OR REPLACE FUNCTION set_kyc_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_kyc_sessions_updated_at
  BEFORE UPDATE ON kyc_sessions
  FOR EACH ROW
  EXECUTE FUNCTION set_kyc_sessions_updated_at();

COMMIT;
