# Payment Processor Underwriting Submission Checklist

**Prepared for**: GetFanSee — Payment Processor Application  
**Date**: March 17, 2026  
**Status**: Ready for submission (pending Stripe production key configuration)

---

## Section 1 — Live Legal Pages (All Linked in Footer)

| Page                         | URL        | Status                       | Last Updated |
| ---------------------------- | ---------- | ---------------------------- | ------------ |
| Terms of Service             | `/terms`   | ✅ Live                      | Jan 18, 2026 |
| Privacy Policy               | `/privacy` | ✅ Live (GDPR/CCPA added)    | Jan 18, 2026 |
| Refund & Cancellation Policy | `/refund`  | ✅ Live                      | Mar 17, 2026 |
| DMCA / Copyright Policy      | `/dmca`    | ✅ Live                      | Mar 17, 2026 |
| 18 U.S.C. § 2257 Statement   | `/2257`    | ✅ Live                      | Mar 17, 2026 |
| About / Legal Entity         | `/about`   | ✅ Live (company info added) | Mar 17, 2026 |
| FAQ                          | `/faq`     | ✅ Live                      | —            |
| Support / Contact            | `/support` | ✅ Live                      | —            |

**Footer verification**: All 8 links appear in `SiteFooter` on every page of the site.

---

## Section 2 — Screenshots Required for Submission

The following screenshots must be prepared from the live site before submission:

### 2.1 Checkout Flow

- [ ] `checkout-step-1-wallet-topup.png` — Wallet "Add Funds" dialog showing amount selector
- [ ] `checkout-step-2-stripe.png` — Stripe Checkout page (after redirect) showing:
  - Amount
  - Billing descriptor: **GETFANSEE.COM**
  - SSL padlock visible
- [ ] `checkout-step-3-success.png` — `/me/wallet?payment=success` page showing success banner

### 2.2 Subscription Purchase

- [ ] `subscription-paywall-modal.png` — PaywallModal showing:
  - Creator name
  - Monthly price
  - "Billed monthly · Cancel anytime" notice
  - Billing descriptor: **GETFANSEE.COM**

### 2.3 Receipt / Order Confirmation Emails

- [ ] `email-subscription-confirmation.png` — Screenshot of subscription confirmation email showing:
  - Amount charged
  - Next billing date
  - Billing descriptor: **GETFANSEE.COM**
  - Cancellation link to `/subscriptions`
- [ ] `email-ppv-confirmation.png` — Screenshot of PPV purchase confirmation email

### 2.4 Cancellation Flow

- [ ] `cancel-step-1-subscriptions-list.png` — `/subscriptions` page showing active subscriptions with Cancel button
- [ ] `cancel-step-2-confirm-dialog.png` — Cancellation confirmation dialog
- [ ] `cancel-step-3-cancelled.png` — Subscriptions page after cancellation showing "Cancelled" status

### 2.5 Age Gate

- [ ] `age-gate-popup.png` — Age verification popup on first visit to homepage
- [ ] `age-gate-enter-button.png` — "Enter Site — I am 18+" button

### 2.6 All Legal Pages

- [ ] `page-terms.png` — Full Terms of Service page (scroll to show Governing Law section)
- [ ] `page-privacy.png` — Privacy Policy page (scroll to show GDPR/CCPA sections)
- [ ] `page-refund.png` — Refund & Cancellation Policy page
- [ ] `page-dmca.png` — DMCA Policy page
- [ ] `page-2257.png` — 2257 Compliance Statement page
- [ ] `page-about.png` — About page showing Legal Entity section with company registration

### 2.7 Creator Verification (KYC)

- [ ] `kyc-upload-form.png` — Creator KYC form showing ID upload requirement

---

## Section 3 — Billing Descriptor Verification

The billing descriptor **GETFANSEE.COM** appears in:

| Location                               | File                                                | Status |
| -------------------------------------- | --------------------------------------------------- | ------ |
| PaywallModal checkout UI               | `components/paywall-modal.tsx` L374                 | ✅     |
| Wallet page                            | `app/me/wallet/page.tsx`                            | ✅     |
| Subscription confirmation email        | `lib/email.ts`                                      | ✅     |
| PPV confirmation email                 | `lib/email.ts`                                      | ✅     |
| FAQ page                               | `app/faq/page.tsx`                                  | ✅     |
| Refund Policy page                     | `app/refund/page.tsx`                               | ✅     |
| Stripe PaymentIntent descriptor suffix | `app/api/payments/create-checkout-session/route.ts` | ✅     |

---

## Section 4 — Technical Compliance Summary

| Requirement             | Status | Evidence                                                      |
| ----------------------- | ------ | ------------------------------------------------------------- |
| HTTPS everywhere        | ✅     | HSTS header `max-age=31536000` in `next.config.mjs`           |
| SSL visible on checkout | ✅     | Stripe Checkout handles SSL natively                          |
| Cookie consent banner   | ✅     | `components/cookie-consent.tsx`                               |
| Mobile-friendly         | ✅     | Responsive design, tested on mobile breakpoints               |
| No broken links         | ✅     | `/post/` routes fixed to `/posts/`                            |
| Age gate                | ✅     | `components/age-gate.tsx` — self-declaration with audit log   |
| Creator KYC             | ✅     | `app/creator/upgrade/kyc/page.tsx` — ID upload + admin review |
| One-click cancellation  | ✅     | `/subscriptions` page with Cancel button                      |
| Refund policy           | ✅     | `/refund` — 14-day window, process documented                 |
| Content moderation      | ✅     | Admin content review + user reporting system                  |
| DMCA agent              | ✅     | `dmca@getfansee.com`                                          |
| 2257 compliance         | ✅     | Secondary producer statement on `/2257`                       |

---

## Section 5 — Pre-Submission Action Items

### Required Before Submission

1. **Configure Stripe production keys** in Vercel environment variables:
   ```
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
   ```
2. **Register Stripe webhook** in Stripe Dashboard:
   - Endpoint: `https://getfansee.com/api/webhooks/stripe`
   - Events: `checkout.session.completed`, `payment_intent.payment_failed`
3. **Update About page** with real registered company details (verify ACN number with legal team)
4. **Prepare sample order confirmation emails** — send test transactions and screenshot actual emails received

### Recommended Before Submission

5. Set up live chat (e.g., Intercom) for faster dispute resolution
6. Consider third-party age verification (AgeChecker.Net, Yoti) for stricter processor requirements
7. Test complete checkout flow end-to-end in production with a real card

---

## Section 6 — Contact Information for Underwriting

| Type               | Contact                                                       |
| ------------------ | ------------------------------------------------------------- |
| General            | hello@getfansee.com                                           |
| Legal / Compliance | legal@getfansee.com                                           |
| Support            | support@getfansee.com                                         |
| Privacy            | privacy@getfansee.com                                         |
| DMCA               | dmca@getfansee.com                                            |
| Registered Address | Suite 1, Level 2, 123 Tech Street, Sydney NSW 2000, Australia |
