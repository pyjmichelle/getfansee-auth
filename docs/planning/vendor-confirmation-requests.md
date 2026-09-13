# Vendor Confirmation Requests (P0 blockers)

Two vendors gate the payment rail. Neither can be resolved in code — both need a written
answer on file before the corresponding phase ships. Track answers in the "Status" column and
attach the reply (email/PDF) under `docs/reports/vendor-confirmations/`.

| Vendor | Blocks                   | Status  | Answer received |
| ------ | ------------------------ | ------- | --------------- |
| Didit  | Phase -1 (age assurance) | Pending | —               |
| PayRam | Phase 0 (payment rail)   | Pending | —               |

---

## 1. Didit — age assurance & KYC

We already use Didit for creator KYC (`lib/kyc/didit-client.ts`). We intend to extend it to
fan-side age assurance across the UK, EU, Australia, Brazil and 26 US states. Two things must be
confirmed in writing first.

### 1.1 Adult-industry acceptability

Didit's public marketing names adult content platforms as a target vertical, and the company blog
discusses creator-economy platforms (OnlyFans, Patreon) explicitly. However
[Business Terms §6.4](https://didit.me/terms/business/) restricts clients from using the Services
for any "unlawful, discriminatory, fraudulent, misleading, defamatory, **obscene**, abusive,
harmful purpose".

Read plainly, "obscene" qualifies the _purpose for which the Services are used_ (we use them for
lawful age-assurance compliance), not the client's industry. We need that reading confirmed.

**Ask:**

1. Please confirm that a lawful adult-content subscription platform (user-generated adult content,
   18+ only, US-incorporated) is an accepted client under your Business Terms, and that §6.4's
   "obscene" restriction does not exclude our use case.
2. Are there any additional terms, review steps, or pricing differences for adult-industry clients?
3. Is there any jurisdiction where you would decline to serve an adult-content client?

### 1.2 US state-law method coverage

Didit's own documentation states that Age Estimation is "model-predicted from the face, not
verified against a document — use it for age gates and low-friction checks, **not as legal proof of
age**". Ofcom accepts facial age estimation as highly effective for the UK, but US state statutes
enumerate specific methods: government-issued identification, digitised identification (state mDL),
public or private **transactional data**, a **commercial database** regularly used for age/identity
verification, or (in some states) any "commercially reasonable method".

**Ask:**

1. Which Didit product(s) satisfy the enumerated methods in US state age-verification statutes —
   Identity Document Verification, your "1,000+ government data sources" Database Validation, or
   both? Please map product → statutory method category.
2. Do you offer a US-specific age-assurance workflow that returns a pass/fail suitable as an
   affirmative defence, and can you supply an **audit record** (verification performed, method,
   timestamp, result) that we can retain as evidence?
3. **Data retention**: several statutes forbid retaining personally identifying information after
   access is granted. Confirm that we can operate in a mode where GetFanSee receives only a
   result plus a session reference, and Didit holds (and deletes) the document/PII on its side.
   What is your retention period, and is it configurable?
4. **Florida** requires at least one _anonymous_ verification option. Does facial age estimation
   qualify in your assessment, and can it be offered as a standalone option in that state?
5. **Ohio** requires periodic re-verification without specifying an interval. Do you support
   re-verification against a prior session at reduced cost (i.e. not a full re-KYC)?
6. Do you have existing adult-platform customers operating under US state age-verification laws?

### 1.3 Commercial

1. Confirm current pricing: Age Estimation $0.10/check, ID Verification fallback $0.15/check,
   full KYC bundle $0.33/session, 500 free verifications per workspace per month.
2. Any volume commitment or contract required at our expected scale?
3. Is the free tier available on the same account already used for creator KYC, or does fan-side
   age assurance need a separate workspace?

---

## 2. PayRam — payment rail

We intend to self-host PayRam on our own VPS and accept **USDC on Base** only, using the
card-to-crypto onramp via the PayRam Wallet method.

### 2.1 Adult acceptability (the single biggest viability question)

PayRam is self-hosted and non-custodial, and your documentation states merchants do **not** need
KYC/KYB to enable the Card-to-Crypto onramp. However, onramp transactions are "powered by
regulated, third-party fiat-to-crypto providers" with their own risk policies.

**Ask:**

1. Please confirm in writing that a lawful adult-content platform may use PayRam, including the
   Card-to-Crypto onramp.
2. Which third-party onramp provider(s) power the PayRam Wallet card flow, and do **their**
   acceptable-use policies permit the customer to subsequently pay an adult merchant?
3. Since onramp funds land in the _customer's_ self-custodial wallet before they pay us, is the
   onramp provider's relationship with the consumer rather than the merchant? If so, does the
   merchant's industry factor into their risk decision at all?
4. Has any adult merchant had card payments disabled after activation? Under what circumstances
   would the card channel be withdrawn?

### 2.2 Fees

1. What is the effective end-user cost of a card-to-crypto purchase (percentage and any fixed fee),
   by region and amount band? We understand PayRam adds no markup — we need the partner's rates.
2. What is the **minimum** card purchase amount? We plan fixed top-up tiers of $20 / $50 / $100.
3. Who bears the onramp fee — is it added on top of the amount the customer enters, so that the
   merchant receives the full requested USDC amount?
4. Gas sponsorship on Base: what does it cost the merchant if enabled?

### 2.3 Technical

1. Confirm the webhook signature scheme: `X-Payram-Signature` = `sha256=` + HMAC-SHA256 of the raw
   request body keyed with the project API key. Is the key the project API key or a separate
   webhook secret?
2. Confirm `reference_id` is stable across all webhook deliveries for one payment and is safe as
   our sole idempotency key.
3. For `OVER_FILLED`, is `filled_amount_in_usd` always the authoritative received amount?
4. Can a project be locked to a single currency + network (USDC / BASE) server-side, in addition to
   passing `currency` and `network` on each payment creation?
5. What are the minimum VPS specs and the recommended backup/key-management procedure for the
   cold-wallet SmartSweep configuration?
6. If PayRam were to discontinue the product, what is the documented path to recovering funds and
   migrating deposit addresses?

---

## Recording answers

When a reply arrives:

1. Save the raw email/PDF to `docs/reports/vendor-confirmations/<vendor>-<yyyymmdd>.<ext>`.
2. Update the status table at the top of this file.
3. If the answer is negative or ambiguous, do **not** proceed with the dependent phase — escalate
   to the fallback documented in `docs/planning/us-compliance-and-payment-rail.md`.
