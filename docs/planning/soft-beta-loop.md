# Soft Beta — small-amount closed loop

The last gate before payments open to the public. Nothing here is a code task;
it is a sequence of things that must be observed happening with real money, in
small amounts, on production infrastructure.

The rule this document exists to enforce: **the loop is not proven until a full
settlement cycle has completed and the reconciliation identities balance at
zero.** A successful top-up is not proof. A successful purchase is not proof.
Money arriving in Paxum is not proof. Only the closed cycle is.

## Preconditions

All of these must already be true before starting.

- [ ] Phase 0 signed off — see [`payram-phase0-validation.md`](payram-phase0-validation.md)
- [ ] Didit written confirmation received (adult industry + US state law coverage)
- [ ] Legal opinion received on MTL/MSB classification and the voucher tax point
- [ ] Migrations `050`, `051`, `052` applied to production
- [ ] `PAYRAM_ENABLED=true`, `PAYRAM_BASE_URL`, `PAYRAM_API_KEY` set
- [ ] `AGE_ASSURANCE_ENABLED=true`, `AGE_ASSURANCE_SECRET` set
- [ ] `STRIPE_FIAT_ENABLED` unset or `false` — the legacy rail stays closed
- [ ] `CRON_SECRET` set and `/api/cron/settlement` scheduled
- [ ] Cold wallet key backed up offline, and the backup restored once on a
      different machine to prove it is a real backup

## Stage 1 — Access control, before any money

Verified with real IPs, not header overrides. The test-only geo headers exist
for CI and prove nothing about production.

- [ ] Sanctioned country IP → `/blocked`, reason `sanctions`
- [ ] Adult-content-illegal country IP → `/blocked`, reason `adult_content_illegal`
- [ ] Tennessee IP → `/blocked`, reason `state_excluded`
- [ ] Texas IP, no assurance cookie → redirected to `/age-check`, document tier
- [ ] Florida IP → anonymous (facial estimation) option is offered
- [ ] UK IP → `/age-check`, estimation tier
- [ ] Untested state IP → browsable under self-attestation
- [ ] EU IP → can browse, **cannot** reach top-up (`region_not_supported`)
- [ ] Direct `GET /api/posts/<locked>` from a covered state without a cookie → 403.
      Client-side gating is not gating.
- [ ] `age_assurance_checks` rows contain no PII — no name, no document number,
      no image URL

## Stage 2 — One real top-up

Use $20. Use a real card. Use a real fan account.

- [ ] Top-up screen states the onramp fee before the fan commits, and the stated
      total is within a dollar of what the card is actually charged
- [ ] `payment_orders` row exists in `OPEN` before the fan reaches the hosted page
- [ ] Webhook arrives, signature verifies, wallet credits **once**
- [ ] Credited amount equals what actually arrived on-chain, not what was requested
- [ ] Record: card charged, USDC received, minutes from card to credit

```bash
pnpm payram:replay --reference=<reference_id> --amount=20
```

- [ ] All five replay checks pass
- [ ] Wallet balance is unchanged by the replays — check the number, do not
      trust the API response

## Stage 3 — Spending

- [ ] PPV unlock: fan debited, `consumption_orders` row written, creator credited
      to **pending**, access granted — all present, or all absent
- [ ] Tip: same
- [ ] Subscription: same, and the grant is cancelled if the charge fails
- [ ] `platform_fee_bps` is snapshotted on the order at 2000 (or 0 for a
      Founding Creator), not looked up later
- [ ] `buyer_country` / `buyer_region` recorded on every order
- [ ] Insufficient balance → 402, and nothing at all is written
- [ ] Duplicate idempotency key → one charge, one order

## Stage 4 — Reversal

Reverse one of each, and confirm the creator side unwinds the right way.

- [ ] Reverse a PPV while the creator's earning is still `pending` →
      `clawback_pending`, and the fan loses access to the post
- [ ] Reverse one after settlement but before payout → `clawback_available`
- [ ] Reverse one after payout → `negative_adjustment`, a debt against future
      earnings, and the creator's balance does not go negative
- [ ] Reversing the same order twice is a no-op
- [ ] Return unspent balance with an `externalReference`, then send the same
      request again → debited once

## Stage 5 — A full settlement cycle

This is the part that cannot be shortened. Wait the hold period out.

- [ ] `available_on` is 7 days out on every earning
- [ ] Before maturity, the cron run settles nothing
- [ ] After maturity, pending moves to available for the right creators and the
      right amounts
- [ ] Two overlapping cron runs settle each entry exactly once
- [ ] Off-ramp a small amount and land it in Paxum; record the spread and fees
- [ ] Pay one creator; record `payout_batches` and the external reference

## Stage 6 — The gate

```bash
pnpm reconcile:full
```

- [ ] `credited_deposits_match_orders` — zero
- [ ] `consumption_splits_balance` — zero
- [ ] `creator_ledger_matches_wallets` — zero
- [ ] `fan_liability_matches_balances` — zero

A non-zero difference is not rounding. The ledger is integer cents; there is
nothing to round. Every cent must be explained transaction by transaction
before anything opens.

Then the standard gates:

```bash
pnpm check-all
pnpm build
pnpm qa:gate
pnpm exec playwright test --project=chromium
```

## Stage 7 — Books

- [ ] Fan top-ups appear as a liability, not as revenue
- [ ] Platform fee appears as revenue only at consumption
- [ ] Each crypto-to-fiat conversion is recorded with its cost basis and
      realised gain or loss, per conversion
- [ ] `pnpm reconcile:full` nexus breakdown reviewed against the $100k / 200
      transaction state thresholds

## Go / no-go

Open the loop only if every box above is ticked. Any of the following is an
automatic no-go, regardless of how well everything else went:

- any reconciliation identity non-zero
- any double credit, in any circumstance, including deliberate replay
- a fan reaching paid content from a covered state without assurance
- a creator balance that can go negative
- a settlement cycle that has not been observed end to end
