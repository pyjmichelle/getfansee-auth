-- Migration 041: Relax NOT NULL constraints on creator_verifications
--
-- When using Didit hosted KYC, the user's real_name / birth_date / country /
-- id_doc_urls are provided by the KYC provider — not collected in our own form.
-- These columns must be nullable so we can create the verification record at
-- session-initiation time (before Didit returns any identity data).

ALTER TABLE public.creator_verifications
  ALTER COLUMN real_name DROP NOT NULL,
  ALTER COLUMN birth_date DROP NOT NULL,
  ALTER COLUMN country DROP NOT NULL,
  ALTER COLUMN id_doc_urls DROP NOT NULL;

-- Set sensible defaults for new inserts
ALTER TABLE public.creator_verifications
  ALTER COLUMN real_name SET DEFAULT NULL,
  ALTER COLUMN id_doc_urls SET DEFAULT '{}';
