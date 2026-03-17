import { Resend } from "resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_ADDRESS = process.env.RESEND_FROM_ADDRESS || "GetFanSee <noreply@getfansee.com>";
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || "https://getfansee.com";

const BILLING_DESCRIPTOR = "GETFANSEE.COM";

function getResend(): Resend | null {
  if (!RESEND_API_KEY) {
    console.warn("[email] RESEND_API_KEY not configured — email sending disabled");
    return null;
  }
  return new Resend(RESEND_API_KEY);
}

function baseEmailHtml(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#e2e8f0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#12121a;border-radius:16px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#7c3aed,#a855f7);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;font-size:28px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">GetFanSee</h1>
              <p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,0.8);">Where fans get closer</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              ${body}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
              <p style="margin:0 0 8px;font-size:12px;color:#64748b;">
                Charges appear on your statement as <strong style="color:#94a3b8;">${BILLING_DESCRIPTOR}</strong>
              </p>
              <p style="margin:0;font-size:11px;color:#475569;">
                <a href="${SITE_URL}/terms" style="color:#7c3aed;text-decoration:none;">Terms</a> &nbsp;·&nbsp;
                <a href="${SITE_URL}/privacy" style="color:#7c3aed;text-decoration:none;">Privacy</a> &nbsp;·&nbsp;
                <a href="${SITE_URL}/refund" style="color:#7c3aed;text-decoration:none;">Refund Policy</a> &nbsp;·&nbsp;
                <a href="${SITE_URL}/support" style="color:#7c3aed;text-decoration:none;">Support</a>
              </p>
              <p style="margin:8px 0 0;font-size:11px;color:#334155;">
                © ${new Date().getFullYear()} GetFanSee. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export interface SubscriptionConfirmationParams {
  toEmail: string;
  toName: string;
  creatorName: string;
  amountCents: number;
  nextBillingDate: string;
  cancelUrl: string;
}

export async function sendSubscriptionConfirmation(
  params: SubscriptionConfirmationParams
): Promise<void> {
  const resend = getResend();
  if (!resend) return;

  const amount = (params.amountCents / 100).toFixed(2);

  const body = `
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#f1f5f9;">Subscription Confirmed</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#94a3b8;">Hi ${params.toName}, you&apos;re now subscribed to ${params.creatorName}.</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(124,58,237,0.08);border:1px solid rgba(124,58,237,0.2);border-radius:12px;margin-bottom:24px;">
      <tr>
        <td style="padding:20px 24px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size:13px;color:#94a3b8;padding-bottom:8px;">Amount charged</td>
              <td align="right" style="font-size:18px;font-weight:700;color:#f1f5f9;padding-bottom:8px;">$${amount}/month</td>
            </tr>
            <tr>
              <td style="font-size:13px;color:#94a3b8;padding-bottom:8px;">Next billing date</td>
              <td align="right" style="font-size:13px;color:#f1f5f9;padding-bottom:8px;">${params.nextBillingDate}</td>
            </tr>
            <tr>
              <td style="font-size:13px;color:#94a3b8;">Statement descriptor</td>
              <td align="right" style="font-size:13px;color:#a78bfa;font-weight:600;">${BILLING_DESCRIPTOR}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 16px;font-size:14px;color:#94a3b8;">
      Your subscription renews automatically each month. You can cancel anytime from your
      <a href="${SITE_URL}/subscriptions" style="color:#7c3aed;text-decoration:none;">Subscriptions page</a>.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding:8px 0;">
          <a href="${params.cancelUrl}" style="display:inline-block;padding:12px 28px;background:transparent;border:1px solid rgba(255,255,255,0.15);border-radius:8px;font-size:13px;color:#94a3b8;text-decoration:none;">
            Cancel Subscription
          </a>
        </td>
      </tr>
    </table>

    <p style="margin:24px 0 0;font-size:12px;color:#475569;text-align:center;">
      If you have any questions, contact us at
      <a href="mailto:support@getfansee.com" style="color:#7c3aed;text-decoration:none;">support@getfansee.com</a>
    </p>
  `;

  await resend.emails.send({
    from: FROM_ADDRESS,
    to: params.toEmail,
    subject: `Subscription confirmed — ${params.creatorName} on GetFanSee`,
    html: baseEmailHtml("Subscription Confirmed", body),
  });
}

export interface PPVConfirmationParams {
  toEmail: string;
  toName: string;
  creatorName: string;
  contentTitle: string;
  amountCents: number;
  contentUrl: string;
  transactionDate: string;
}

export async function sendPPVConfirmation(params: PPVConfirmationParams): Promise<void> {
  const resend = getResend();
  if (!resend) return;

  const amount = (params.amountCents / 100).toFixed(2);

  const body = `
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#f1f5f9;">Purchase Confirmed</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#94a3b8;">Hi ${params.toName}, you&apos;ve unlocked content from ${params.creatorName}.</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(124,58,237,0.08);border:1px solid rgba(124,58,237,0.2);border-radius:12px;margin-bottom:24px;">
      <tr>
        <td style="padding:20px 24px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size:13px;color:#94a3b8;padding-bottom:8px;">Content</td>
              <td align="right" style="font-size:13px;color:#f1f5f9;padding-bottom:8px;">${params.contentTitle}</td>
            </tr>
            <tr>
              <td style="font-size:13px;color:#94a3b8;padding-bottom:8px;">Amount charged</td>
              <td align="right" style="font-size:18px;font-weight:700;color:#f1f5f9;padding-bottom:8px;">$${amount}</td>
            </tr>
            <tr>
              <td style="font-size:13px;color:#94a3b8;padding-bottom:8px;">Transaction date</td>
              <td align="right" style="font-size:13px;color:#f1f5f9;padding-bottom:8px;">${params.transactionDate}</td>
            </tr>
            <tr>
              <td style="font-size:13px;color:#94a3b8;">Statement descriptor</td>
              <td align="right" style="font-size:13px;color:#a78bfa;font-weight:600;">${BILLING_DESCRIPTOR}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding:8px 0;">
          <a href="${params.contentUrl}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#7c3aed,#a855f7);border-radius:8px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">
            View Content
          </a>
        </td>
      </tr>
    </table>

    <p style="margin:24px 0 0;font-size:12px;color:#475569;text-align:center;">
      Refund requests must be submitted within 14 days.
      <a href="${SITE_URL}/refund" style="color:#7c3aed;text-decoration:none;">Refund Policy</a> &nbsp;·&nbsp;
      <a href="mailto:support@getfansee.com" style="color:#7c3aed;text-decoration:none;">Contact Support</a>
    </p>
  `;

  await resend.emails.send({
    from: FROM_ADDRESS,
    to: params.toEmail,
    subject: `Purchase receipt — ${params.creatorName} on GetFanSee`,
    html: baseEmailHtml("Purchase Confirmed", body),
  });
}
