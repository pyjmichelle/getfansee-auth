-- Migration 054: bind an age check to the browser that started it
--
-- Problem this closes: the vendor callback URL carries the evidence row id in a
-- query parameter (`/api/age-assurance/callback?check=<uuid>`), and the route
-- treated possession of that id as proof of a passed check. A URL is not a
-- secret — it lands in browser history, in the vendor's logs, in a Referer
-- header, in a screenshot of a shared screen. Anyone replaying it received the
-- signed gate cookie without ever facing the vendor, and could keep replaying
-- it to refresh access past the 24h TTL, since a settled row stays 'passed'
-- forever.
--
-- Fix has two halves, both of which need state here:
--
--   claim_secret_hash  SHA-256 of a 256-bit secret minted at /start and handed
--                      to the visitor as an httpOnly cookie. The callback must
--                      present it, which binds the exchange to the browser
--                      that opened the session. The plaintext secret is never
--                      stored, so a database leak does not yield claimable
--                      checks.
--
--   claimed_at         One-shot marker. The cookie is issued by a single
--                      conditional UPDATE guarded on `claimed_at IS NULL`, so
--                      a replay — or two concurrent requests racing — finds
--                      zero rows and is refused.
--
-- Additive only: existing rows get NULLs, and a NULL `claim_secret_hash` can
-- never satisfy the callback's equality test, so in-flight checks from before
-- this migration fail closed rather than open.

ALTER TABLE public.age_assurance_checks
  ADD COLUMN IF NOT EXISTS claim_secret_hash text,
  ADD COLUMN IF NOT EXISTS claimed_at        timestamptz;

COMMENT ON COLUMN public.age_assurance_checks.claim_secret_hash IS
  'SHA-256 of the one-time secret held by the starting browser. Proves the callback comes from the visitor who opened the session.';

COMMENT ON COLUMN public.age_assurance_checks.claimed_at IS
  'When the gate cookie was issued for this check. Non-null means the check is spent and cannot mint another cookie.';

-- ── Verification ─────────────────────────────────────────────────────────────

DO $$
BEGIN
  RAISE NOTICE 'claim_secret_hash present: %', (
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'age_assurance_checks'
        AND column_name = 'claim_secret_hash'
    )
  );
  RAISE NOTICE 'claimed_at present: %', (
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'age_assurance_checks'
        AND column_name = 'claimed_at'
    )
  );
END $$;
