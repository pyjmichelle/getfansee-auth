# Pre-Launch Operator Checklist — Non-Development Items

> **Purpose:** This document lists everything the business operator (you) must personally prepare before submitting a payment processor application or going live. These items cannot be automated or coded — they require real-world information, legal decisions, or third-party accounts.
>
> **Financial items are currently mocked in code** and must be replaced with real data before production launch.

---

## 1. Legal Entity Information

These placeholders exist in the live site and **must be replaced before processor submission**:

| Field                           | Current Placeholder                                           | What You Need                                           |
| ------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------- |
| Company Name                    | GetFanSee Pty Ltd                                             | Confirm this is your registered company name            |
| Registered Address              | Suite 1, Level 2, 123 Tech Street, Sydney NSW 2000, Australia | Your **real** registered business address               |
| ACN (Australian Company Number) | `000 000 000`                                                 | Your **real** ACN from ASIC registration                |
| DMCA Agent Contact              | `dmca@getfansee.com`                                          | A **monitored** email inbox; must be responsive         |
| 2257 Records Custodian          | `compliance@getfansee.com`                                    | Real name + address of the designated records custodian |
| Privacy / DPO Contact           | `privacy@getfansee.com`                                       | A **monitored** email inbox; required by GDPR/CCPA      |
| Legal / Arbitration Contact     | `legal@getfansee.com`                                         | A **monitored** email inbox                             |
| Support Contact                 | `support@getfansee.com`                                       | A **monitored** email inbox with SLA (24h response)     |

**Action required:** Register "GetFanSee Pty Ltd" with ASIC (Australian Securities & Investments Commission) if not already done. Get your ACN, then update `app/about/page.tsx`.

---

## 2. Payment Processor Application Materials

When applying to Stripe (or any adult-content-friendly processor), you will need to provide:

### Business Documents

- [ ] Certificate of incorporation / ASIC company extract
- [ ] Proof of business address (utility bill, bank statement, or lease — issued within 3 months)
- [ ] Director(s) government-issued photo ID (passport or driver's licence)
- [ ] Director(s) proof of personal address

### Bank Account

- [ ] Business bank account details (BSB + account number, or IBAN/SWIFT for international)
- [ ] Bank statement or voided cheque showing account name matches registered company name

### Business Description

- [ ] Written description of your business model (adult subscription platform, creator-to-fan)
- [ ] Estimated monthly transaction volume (AUD)
- [ ] Average transaction value
- [ ] Projected chargeback rate

### Billing Descriptor

- [ ] Confirm final billing descriptor with your processor — currently mocked as `GETFANSEE.COM` in code
- [ ] Once confirmed, update `lib/email.ts` constant `BILLING_DESCRIPTOR` and `app/api/payments/create-checkout-session/route.ts`

---

## 3. Domain & Hosting Proof

- [ ] Confirm you own the domain `getfansee.com` (or your production domain) — registrar proof required
- [ ] Site must be fully live on a production URL (not localhost, Vercel preview, or staging)
- [ ] SSL certificate must be active and visible (padlock in browser)
- [ ] Processor will visit the live URL — ensure all pages listed in this document are accessible

---

## 4. KYC / Age Verification Service (Didit)

The codebase already integrates with [Didit](https://didit.me) for creator KYC verification.

- [ ] Create a production Didit account at https://didit.me
- [ ] Get your production `DIDIT_CLIENT_ID` and `DIDIT_CLIENT_SECRET`
- [ ] Set up your Didit webhook endpoint pointing to `https://yourdomain.com/api/webhooks/didit`
- [ ] Add Didit credentials to your production environment variables:
  ```
  DIDIT_CLIENT_ID=
  DIDIT_CLIENT_SECRET=
  DIDIT_WEBHOOK_SECRET=
  ```
- [ ] Test the KYC flow end-to-end in production before processor submission
- [ ] Retain evidence that you have a 3rd-party age/ID verification process in place (Didit dashboard screenshots)

---

## 5. Email Service (Resend)

Transactional emails (subscription receipts, PPV receipts, cancellation confirmations) are sent via [Resend](https://resend.com).

- [ ] Create a Resend production account
- [ ] Add and verify your sending domain (e.g., `mail.getfansee.com` or `noreply@getfansee.com`)
  - This requires adding DNS records (SPF, DKIM, DMARC) to your domain registrar
- [ ] Get your production `RESEND_API_KEY` and add it to environment variables
- [ ] Send a test subscription confirmation email and screenshot it — processors require sample receipt screenshots during underwriting

---

## 6. Content Moderation Policy Decisions

These are policy decisions you (as operator) must make and document. The code has a moderation admin panel, but the policies need to be defined by you:

- [ ] **Response time SLA for content reports** — currently stated as 48–72 hours in DMCA page. Confirm this is achievable with your team size.
- [ ] **Who reviews flagged content?** — Define the moderation team structure (in-house, outsourced, or AI-assisted). Mention this in your processor application.
- [ ] **NCMEC reporting procedure** — Confirm your process for reporting CSAM to the National Center for Missing & Exploited Children. This is referenced in your Terms but must be a real documented procedure.

---

## 7. Submission Screenshots Package

Before submitting to a payment processor, you must prepare a screenshot package showing:

- [ ] **Checkout flow** — paywall modal showing subscription price, billing descriptor (`GETFANSEE.COM`), recurring billing notice, and cancellation note
- [ ] **Order confirmation email** — sample screenshot of the receipt email with amount, descriptor, and cancellation link
- [ ] **Subscription cancellation screen** — user dashboard cancel flow with confirmation dialog
- [ ] **Age gate** — the 18+ confirmation overlay on first visit
- [ ] **All legal pages** — Terms, Privacy, Refund, DMCA, 2257, About, FAQ, Support, Acceptable Use (screenshots of each, dated)
- [ ] **Footer** — showing all policy links are visible on homepage
- [ ] **Creator KYC** — screenshot of the KYC upload form

**Tip:** Use the browser's "Save as PDF" on each legal page, and record a short screen capture of the checkout and cancellation flows.

---

## 8. Legal Review Recommendations

> **⚠️ Not legal advice — consult a qualified attorney.**

- [ ] Have a lawyer review your **Terms of Service** — particularly §14 (Arbitration Clause) for enforceability under Australian consumer law (ACL). The current ACICA arbitration clause may conflict with certain ACL protections for consumers.
- [ ] Have a lawyer review your **Privacy Policy** for GDPR adequacy (if you have EU users) and CCPA compliance (if you have California users).
- [ ] Confirm your **refund policy** is compliant with Australian Consumer Law (ACL) — ACL mandates refunds for major failures regardless of "no refunds" clauses.
- [ ] Review **2257 record-keeping obligations** with a US-licensed attorney if any of your creators or content subjects are US-based.

---

## 9. Environment Variables Checklist (Production)

These must be set in your production environment (Vercel / server) before launch:

| Variable                             | Purpose                       | Status                                  |
| ------------------------------------ | ----------------------------- | --------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`           | Supabase project URL          | Set up in Supabase dashboard            |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`      | Supabase anon key             | Set up in Supabase dashboard            |
| `SUPABASE_SERVICE_ROLE_KEY`          | Supabase service role         | Set up in Supabase dashboard            |
| `STRIPE_SECRET_KEY`                  | Stripe live key               | Get from Stripe dashboard (live mode)   |
| `STRIPE_WEBHOOK_SECRET`              | Stripe webhook signing secret | Set after registering webhook endpoint  |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key        | Get from Stripe dashboard (live mode)   |
| `RESEND_API_KEY`                     | Email sending                 | Get from Resend dashboard               |
| `DIDIT_CLIENT_ID`                    | KYC verification              | Get from Didit dashboard                |
| `DIDIT_CLIENT_SECRET`                | KYC verification              | Get from Didit dashboard                |
| `DIDIT_WEBHOOK_SECRET`               | KYC webhook verification      | Get from Didit dashboard                |
| `BETTER_AUTH_SECRET`                 | Auth session signing          | Generate with `openssl rand -base64 32` |
| `NEXT_PUBLIC_APP_URL`                | Production domain             | e.g. `https://getfansee.com`            |

---

## Summary: Blocking vs. Non-Blocking

### 🔴 Blocking (cannot launch without these)

- Real ACN replacing `000 000 000` in About page
- Real registered business address
- Real monitored email inboxes for all policy contacts
- Domain ownership + live SSL site
- Stripe / processor account approved
- Production Resend domain verified
- All environment variables set

### 🟡 Should-Have Before Processor Submission

- Didit KYC production account configured
- Screenshot package prepared
- Legal review of Terms and Privacy Policy
- NCMEC reporting procedure documented

### 🟢 Nice-to-Have (can do post-launch)

- Dedicated DPO (Data Protection Officer) appointment
- ISO 27001 or SOC 2 compliance (for future enterprise processors)

---

_Document generated: March 2026 | Review before each processor application_
