# Funded spending and earned accounts — repair checkpoint

Migration `065_separate_funded_and_earned_balances.sql` follows 059–064. This
file describes code prepared for isolated QA; it does not record a deployment.

## Account contract

| Operation                       | Funded wallet (`wallet_accounts`)    | Earned account (`creator_ledger`)                                    |
| ------------------------------- | ------------------------------------ | -------------------------------------------------------------------- |
| Deposit                         | Credits the payer's spending balance | No change                                                            |
| Subscription, PPV or tip        | Debits funded balance                | Adds recipient pending earnings                                      |
| Settlement                      | No change                            | Pending earnings become available                                    |
| Purchase reversal               | Returns gross to the buyer           | Removes the original earning; existing payouts can leave earned debt |
| Withdrawal request              | No change                            | Reserves earnings with a negative payout row                         |
| Rejected withdrawal             | No change                            | Voids that reservation                                               |
| Paid withdrawal                 | No change                            | Keeps the negative payout and attaches its transfer batch            |
| External return of unused funds | Debits funded balance                | No change                                                            |

Funded wallets have nonnegative balances and no earned pending balance. Earnings
can become negative after a refund following payout; future matured earnings
offset that debt. Deposits cannot repay it or increase withdrawal eligibility.
Creators may purchase using their personal funded balance without reducing
their earned withdrawal eligibility. There is no implicit conversion between
these accounts.

The wallet page displays spending balance; the payout panel displays earnings
and refunded-earnings debt. The owner-only balance RPC preserves caller RLS and
does not create wallets. Legacy purchase writers and unaudited credits are
disabled.

## Migration containment

Disable monetary traffic and use a maintenance window for deployment. The
migration holds exclusive table locks and runs all opening checks before
changing balances. It refuses:

- Historical users who both purchased as fans and have creator earning history.
- Legacy paid earning rows or earned liabilities without a wallet row.
- Pending totals that do not match the ledger, negative funded residuals, or
  residuals that do not match journaled deposits minus purchases and fund returns.
- Earned liabilities that do not match unreversed net sales minus requested or
  paid withdrawals.

It preserves a browser-inaccessible, service-read-only opening audit snapshot
with deletion-restricted user references. A refusal rolls back the complete
migration. Review and reconcile the historic source records separately; do not
skip the checks, invent opening balances or delete financial history to make
the migration pass.

Every active monetary writer takes one global transaction advisory lock before
its existing intent/row locks. This deliberately serializes monetary writes for
the MVP. Replace it with finer locks only after proving a common lock order.
Settlement updates income history only for its actual batch; reversed income
is marked failed and cannot be revived by settlement. Exact payout decisions,
unused-fund refunds and provider credit retries are idempotent; conflicting
accounts, amounts and references are rejected.

## Checks and remaining release gates

The offline suite `tests/sql/wallet-split.mjs` checks isolation, earned debt,
refunds, withdrawals, settlement limits, retry conflicts, owner-only reads,
permissions and complete rollback for rejected opening data. With
`SQL_NATIVE_DATABASE_URL` it also tests concurrent spending/withdrawal-credit
and settlement/refund schedules on multiple PostgreSQL connections.

CI provisions its own temporary PostgreSQL 15 service without hosted database
credentials. Native tests accept only an explicitly isolated loopback target
and create/drop randomly named test databases; they do not reuse application
databases. The native CI result must pass before merge. The local environment
could not initialize a native server because it runs as root and prohibits
switching UID; its PGlite result cannot substitute for this concurrency gate.

Next run this migration against the complete dedicated Supabase schema, verify
live posture, authenticated RLS and provider/webhook E2E, inspect any historical
opening-data refusal, and verify reconciliation. Keep real-money flags disabled
and PR #29 in draft until those checks pass. No production changes are implied
by writing or testing this migration.
