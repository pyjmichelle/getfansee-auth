# Phase 0 — PayRam validation gate

Phase 0 is a **business and infrastructure gate**, not a coding phase. The integration code
(`lib/payram.ts`, `/api/payments/payram/create-payment`, `/api/webhooks/payram`, migration 051) is
already written and can be exercised against mocks. What Phase 0 decides is whether the rail is
real enough to switch on.

`PAYRAM_ENABLED` stays `false` until every box below is ticked. Nothing downstream — Soft Beta,
public launch — may start earlier.

---

## Gate 1 — Written confirmations

| #   | Item                                                                                                            | Owner       | Status |
| --- | --------------------------------------------------------------------------------------------------------------- | ----------- | ------ |
| 1.1 | PayRam confirms in writing that an adult platform may use the product **including the card onramp**             | Business    | ☐      |
| 1.2 | Identity of the third-party onramp provider(s) and confirmation their AUP permits the downstream adult purchase | Business    | ☐      |
| 1.3 | Effective onramp fee schedule by region and amount band, in writing                                             | Business    | ☐      |
| 1.4 | Confirmed minimum card purchase amount                                                                          | Business    | ☐      |
| 1.5 | Webhook signature scheme confirmed: `sha256=` + HMAC-SHA256 over the **raw** body, and which key signs it       | Engineering | ☑      |
| 1.6 | `reference_id` confirmed stable across redeliveries for one payment                                             | Engineering | ☑      |
| 1.7 | Where a fan lands after paying — the API has no `redirectURL` and no return-URL setting is documented           | Engineering | ☐      |

1.5 and 1.6 are answered by the published API reference, not by correspondence:
the [webhook doc](https://docs.payram.com/api-integration/payments-api/webhook)
specifies `X-Payram-Signature` as `sha256=` + HMAC-SHA256 over the raw body
**keyed with the project API key** (so `PAYRAM_WEBHOOK_SECRET` stays empty), and
states that the same status may be delivered more than once and must be keyed
off `reference_id`.

### Wire contract — read this before touching the rail

Verified against the API reference on 2026-09-13. The original integration was
written against assumed field names and three of them were wrong. Each error was
**silent**, which is what makes this table load-bearing rather than pedantic:

| Direction                   | Correct field                  | Wrong guess that was in the code | Consequence of the error                                                      |
| --------------------------- | ------------------------------ | -------------------------------- | ----------------------------------------------------------------------------- |
| Webhook → us                | `status`                       | `state`                          | Every delivery discarded as unknown; deposits never credited, no error logged |
| Us → `POST /api/v1/payment` | `amountInUSD`                  | `amount`                         | Amount not registered as requested                                            |
| Us → `POST /api/v1/payment` | `customerEmail` (**required**) | omitted entirely                 | Payment creation rejected                                                     |
| Us → `POST /api/v1/payment` | — (no such parameter)          | `redirectURL`                    | Ignored; return destination silently unconfigured → 1.7                       |

Also: webhook monetary amounts arrive as **JSON strings**, `filled_amount_in_usd`
is `null` until an on-chain deposit is seen, and the payload carries **no
`network` field**. Webhook status parsing goes through `resolvePayramState()` in
`lib/payram.ts`, which has unit coverage asserting that a `state` key is _not_
accepted — so this regression cannot come back quietly.

Questions are drafted in [`vendor-confirmation-requests.md`](./vendor-confirmation-requests.md) §2.
File replies under `docs/reports/vendor-confirmations/`.

**If 1.1 or 1.2 comes back negative the whole rail is dead** and the fallback is a different
crypto processor with an explicit adult policy. Do not start Gate 2 before 1.1 is answered.

---

## Gate 2 — Infrastructure

| #   | Item                                                                                                                           | Status |
| --- | ------------------------------------------------------------------------------------------------------------------------------ | ------ |
| 2.1 | VPS provisioned, PayRam installed, HTTPS with a valid certificate                                                              | ☐      |
| 2.2 | Project created and **locked to USDC on Base** — no other currency or network enabled                                          | ☐      |
| 2.3 | Cold wallet generated; seed backed up offline in two locations; recovery tested by restoring to a throwaway wallet             | ☐      |
| 2.4 | SmartSweep / forwarding configured to the cold wallet, threshold documented                                                    | ☐      |
| 2.5 | Webhook endpoint registered at the **app** origin + `/api/webhooks/payram` — see the host warning below                        | ☐      |
| 2.6 | `PAYRAM_BASE_URL` + `PAYRAM_API_KEY` set in the deployment environment, `PAYRAM_WEBHOOK_SECRET` left empty (never committed)   | ☐      |
| 2.7 | VPS backup and restore procedure written down and executed once                                                                | ☐      |
| 2.8 | Monitoring: alert if the PayRam node stops responding, and if a webhook has not been received in N hours during active traffic | ☐      |

### 2.5 is the easiest step in this document to get silently wrong

The webhook is the only path that credits a fan, and two plausible-looking hosts
are both wrong:

- `pay.getfansee.com` — that is the PayRam instance itself. It has no
  `/api/webhooks/payram` route, so every delivery 404s and retries forever.
- `getfansee.com` — as of the 2026-08 production audit the apex DNS still
  resolves to a third-party PHP waitlist page rather than this app. Deliveries
  would return 200 from something that is not us, so PayRam would consider them
  acknowledged and never retry. That is the worst possible failure: money
  received, nobody credited, no error anywhere.

The app is the Vercel project `getfansee-auth`, normally `demo.getfansee.com`.
Confirm with `curl -s -o /dev/null -w '%{http_code}' https://demo.getfansee.com/home`
before registering anything.

The dashboard and environment half of this gate is scripted, because it is a
tedious click-path through someone else's UI that is easy to half-finish:

```bash
bash scripts/payram/setup-wizard.sh
```

It captures `PAYRAM_API_KEY` / `PAYRAM_BASE_URL` into `.env.local`, walks the
deposit-wallet and webhook registration steps, and lists whatever you skipped at
the end. It deliberately writes `PAYRAM_ENABLED=false`: configuring the rail is
not the same as being allowed to open it.

### Why the single-currency lock matters

The card onramp only produces USDC/ETH on Base. Accepting a second asset or a second network means
a second set of confirmations semantics, a second reconciliation series and a second cold-wallet
key to protect, for no additional revenue. `lib/payram.ts` hard-codes `currency=USDC` and
`network=BASE` and the webhook rejects anything else — server-side config should match, so that a
mistake has to be made twice to have an effect.

---

## Gate 3 — Small-amount live loop

逐步操作清单（账号、开关、webhook 主机、提现顺序、对账五条）见
[`docs/ops/phase-c-live-money-loop.md`](../ops/phase-c-live-money-loop.md)。

Run against production infrastructure with real money, in this order. Every step produces an
artifact; file them under `docs/reports/payram-phase0/`.

1. **Create.** Call `/api/payments/payram/create-payment` for the $20 tier. Record the returned
   payment URL and our `reference_id`.
2. **Onramp.** Complete the card purchase with a real card. Record: amount charged to the card,
   USDC received in the customer wallet, and the difference. This number is the fan-facing cost we
   must display on the top-up page — see the unit economics in the plan.
3. **Pay.** Send the USDC to the deposit address.
4. **Webhook.** Confirm exactly one `FILLED` webhook arrives, that the signature verifies against
   the raw body, and that the wallet is credited exactly once.
5. **Replay.** Re-POST the identical webhook body and signature. The second call must return
   `idempotent: true` and must not change any balance. Verify with
   `SELECT * FROM payment_orders WHERE reference_id = ...` and the fan's wallet balance.
6. **Tamper.** POST the same body with a mutated `filled_amount_in_usd`. Must return 401 (signature
   fails). POST a valid signature over a body whose amount does not match the order. Must be
   refused, not credited.
7. **Spend.** Unlock a PPV post with the credited balance. Verify the 20% platform fee snapshot,
   the creator's pending balance and the `consumption_orders` row.
8. **Settle.** Run the settlement job. Verify pending → available for the creator.
9. **Off-ramp.** Convert a small amount of USDC to fiat via the P2P route into Paxum. Record the
   effective spread and the elapsed time — these are the real numbers for the cost model.
10. **Pay out.** Send the creator payout from Paxum. Record the fee.
11. **Reconcile.** Run `pnpm reconcile:report` and confirm every identity balances to zero
    difference.

### Numbers to capture

These replace the estimates in the plan once measured:

| Metric                            | Estimate | Measured |
| --------------------------------- | -------- | -------- |
| Card charge for a $20 top-up      | ~$21     |          |
| USDC actually received            | $20.00   |          |
| Base gas cost per deposit         | ≈$0      |          |
| Time from card payment to webhook | —        |          |
| P2P off-ramp spread               | ~1%      |          |
| Paxum inbound fee                 | —        |          |
| Paxum creator payout fee          | —        |          |

---

## Gate 4 — Sign-off

Do not flip `PAYRAM_ENABLED=true` for real users until all of:

- [ ] Gates 1–3 complete with artifacts filed
- [ ] Legal brief §1 (money transmission) and §2 (tax point) answered — see
      [`legal-counsel-brief.md`](./legal-counsel-brief.md)
- [ ] Didit age assurance live and `AGE_ASSURANCE_ENABLED=true`
- [ ] `pnpm check-all && pnpm build && pnpm qa:gate` green
- [ ] Reconciliation report shows zero unexplained difference for a full settlement cycle

Failure of any single item is a stop, not a discussion.
