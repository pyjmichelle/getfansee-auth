# Code repair checkpoint — 2026-10-11

This checkpoint extends draft PR #29. Changes are source code and migration
files only; no hosted database migration, production configuration change,
real payment or test-account deletion was performed.

## Implemented repairs

- Bound monetary retries to their original fan, recipient, content, amount and
  payout method; rejected reuse across intents and replay of reversed orders.
  PPV deduplication is serialized by buyer/content, subscription prices and
  fee snapshots come from the database, and receipts use the actual RPC result.
- Removed duplicate subscription purchase requests; preserved tip intent keys
  and payloads across uncertain responses; blocked edits/closing during spend.
  Paid access remains available until the purchased period ends after canceling.
- Removed paid bodies and raw media URLs from locked server responses. Enforced
  approved/undeleted content and creator geography on nonowner reads. A raw
  video URL is no longer treated as a safe ten-second preview.
- Protected KYC decisions, temporary bans and post moderation fields from
  browser writes. Creator promotion requires the caller's approved verification
  and a server-authorized profile update.
- Made mock recharge a single atomic database operation with bounded amounts
  and intent-bound replay. Hosted production identity overrides test flags;
  monetary spend routes enforce payment geography. Legacy fiat checkout cannot
  be opened in production with a flag alone. Provider requests have timeouts.
- Capped withdrawals by settled earned liabilities and wallet availability,
  including negative ledger rows and unreversed personal spending. A deposit
  cannot restore spent earnings' withdrawal eligibility.
- Corrected creator subscription prices, removed the invented default plan,
  kept private tip messages out of public supporter responses, and displayed
  the creator's resolved commission estimate.
- Improved payment modal keyboard/focus/scroll behavior, network-error handling,
  wallet amount/status display and the latest-50 transaction summary wording.
- Fixed invite signup tab reset and serialized auth test-mode rendering from
  the server to eliminate build/runtime hydration disagreement.
- Isolated test writers from production, removed embedded fixture passwords,
  protected nonfixture accounts from seeding, expanded secret scanning and
  required offline unit/SQL checks in CI. Replaced obsolete integration tests
  with explicitly opt-in contracts; these do not prove positive live flows.

## Validation performed

| Check                                                              | Result and scope                                                                              |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| TypeScript, ESLint, formatting                                     | Passed using direct installed tools                                                           |
| Static service-role, admin-client, credential and financial guards | Passed                                                                                        |
| Unit suite                                                         | 144 passed in 19 files, no remote database                                                    |
| Script security checks                                             | 4 passed                                                                                      |
| Payment SQL regression                                             | 41 checks passed using actual migration functions on a minimal isolated PGlite schema         |
| Security SQL regression                                            | KYC/moderation/profile denial, cancellation RLS, recharge replay/conflict and rollback passed |
| Production build                                                   | Passed with placeholder Supabase credentials                                                  |
| Chromium production smoke                                          | 7 passed, including invitation state and hydration regression; guest pages only               |

Local commands use installed Node binaries because the environment's pnpm
wrapper attempted a dependency reinstall. The browser run used an externally
installed portable Chromium and a temporary local launch configuration; no
machine-specific browser path is committed. It used placeholder database
credentials and cannot validate authenticated database or payment flows.

## Remaining work before backend rollout

1. Provision the dedicated test project/secrets and apply migrations 059–064 in
   numeric order there; verify the complete deployed schema and live posture.
2. Run authenticated multi-user E2E and multi-connection concurrent payment,
   reversal, settlement and withdrawal tests. Offline single-instance SQL
   tests cannot prove production concurrency or provider delivery behavior.
3. Design separate personal-funded and creator-earned accounts, reconcile
   historical transactions and migrate opening balances before real payouts.
   The current conservative cap can understate withdrawable earnings when
   personal spending used deposited funds; it is containment, not separation.
4. Revoke exposed sessions and review storage policies/previously leaked signed
   media URLs; an already issued URL is not revoked by fixing API responses.
5. Verify environment identity, OAuth, age/KYC callbacks, webhook signatures and
   replay, refund/settlement schedules, reconciliation and provider payout
   operations on the test project before enabling any real-money flags.

These items are recorded in `docs/ops/p0-security-runbook.md`. The draft PR
must remain unmerged until the isolated QA/release gate passes. This checkpoint
does not assert that every UI/UX debt item or production integration is resolved.
