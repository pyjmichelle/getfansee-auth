import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "@/lib/icons";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Refund & Cancellation Policy - GetFanSee",
  description: "Understand your rights to cancel subscriptions and request refunds on GetFanSee.",
};

export default function RefundPage() {
  return (
    <div className="min-h-dvh bg-bg-base">
      <div className="max-w-4xl mx-auto px-4 py-12 section-block">
        <Link href="/">
          <Button variant="ghost" className="mb-8 hover-bold">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </Link>

        <h1 className="text-4xl font-bold text-brand-primary mb-8">Refund & Cancellation Policy</h1>

        <div className="card-block p-8 prose prose-invert max-w-none space-y-8">
          <p className="text-text-tertiary">Last updated: March 17, 2026</p>

          <section>
            <h2 className="text-2xl font-semibold mb-4">1. Overview</h2>
            <p className="text-text-secondary">
              GetFanSee is committed to fair and transparent billing. This policy explains your
              rights to cancel subscriptions, request refunds, and how we handle disputes. If you
              have a billing concern, please contact us before initiating a chargeback — we resolve
              the vast majority of issues quickly and fairly.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">2. Cancelling a Subscription</h2>
            <p className="text-text-secondary">
              You may cancel any active subscription at any time, directly from your account:
            </p>
            <ol className="list-decimal pl-6 text-text-secondary space-y-2 mt-3">
              <li>
                Log in and go to{" "}
                <Link
                  href="/subscriptions"
                  className="text-brand-primary underline hover:no-underline"
                >
                  My Subscriptions
                </Link>
                .
              </li>
              <li>
                Find the subscription you wish to cancel and click <strong>Cancel</strong>.
              </li>
              <li>Confirm the cancellation in the dialog that appears.</li>
            </ol>
            <p className="text-text-secondary mt-4">
              Your access continues until the end of the current billing period. You will not be
              charged again after cancellation. There are no cancellation fees.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">3. Subscription Refunds</h2>
            <p className="text-text-secondary">
              Subscription charges may be refunded in the following circumstances:
            </p>
            <ul className="list-disc pl-6 text-text-secondary space-y-2 mt-3">
              <li>
                <strong>Duplicate charge:</strong> You were billed more than once for the same
                subscription in the same billing cycle.
              </li>
              <li>
                <strong>Technical error:</strong> A platform error resulted in an incorrect charge.
              </li>
              <li>
                <strong>Billing after cancellation:</strong> You were charged after successfully
                cancelling your subscription.
              </li>
            </ul>
            <p className="text-text-secondary mt-4">
              Refund requests for subscriptions must be submitted within <strong>14 days</strong> of
              the charge. We do not offer refunds for subscriptions that have been used to access
              content during the billing period unless a qualifying error occurred.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">4. Pay-Per-View & Wallet Purchases</h2>
            <p className="text-text-secondary">
              Pay-per-view (PPV) content unlocks and wallet recharges are generally non-refundable
              once the digital content has been accessed. However, we will review refund requests in
              the following situations:
            </p>
            <ul className="list-disc pl-6 text-text-secondary space-y-2 mt-3">
              <li>The content was materially different from its description.</li>
              <li>A technical error prevented you from accessing purchased content.</li>
              <li>A duplicate charge occurred due to a payment processing error.</li>
              <li>Fraudulent use of your payment method was reported promptly.</li>
            </ul>
            <p className="text-text-secondary mt-4">
              Refund requests for PPV and wallet charges must be submitted within{" "}
              <strong>14 days</strong> of the transaction.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">5. How to Request a Refund</h2>
            <p className="text-text-secondary">
              To request a refund, please contact our support team:
            </p>
            <ul className="list-disc pl-6 text-text-secondary space-y-2 mt-3">
              <li>
                <strong>Email:</strong>{" "}
                <a
                  href="mailto:support@getfansee.com"
                  className="text-brand-primary underline hover:no-underline"
                >
                  support@getfansee.com
                </a>
              </li>
              <li>
                <strong>Support form:</strong>{" "}
                <Link href="/support" className="text-brand-primary underline hover:no-underline">
                  getfansee.com/support
                </Link>
              </li>
            </ul>
            <p className="text-text-secondary mt-4">
              Please include your account email, the transaction date, the amount charged, and a
              brief description of the issue. We aim to respond within{" "}
              <strong>2 business days</strong> and process approved refunds within{" "}
              <strong>5–10 business days</strong> to your original payment method.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">6. Chargebacks & Disputes</h2>
            <p className="text-text-secondary">
              If you have a billing concern, we strongly encourage you to contact us before
              initiating a chargeback with your bank or card issuer. Chargebacks initiated without
              first contacting GetFanSee support may result in:
            </p>
            <ul className="list-disc pl-6 text-text-secondary space-y-2 mt-3">
              <li>Temporary suspension of your account pending investigation.</li>
              <li>Permanent account termination for repeated or fraudulent disputes.</li>
            </ul>
            <p className="text-text-secondary mt-4">
              We will always cooperate with your bank&apos;s dispute resolution process and provide
              all relevant transaction records.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">7. What Will Appear on Your Statement</h2>
            <p className="text-text-secondary">
              Charges from GetFanSee will appear on your bank or credit card statement as{" "}
              <strong>GETFANSEE.COM</strong>. If you do not recognise a charge, please contact us
              before disputing it with your bank.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">8. Contact</h2>
            <p className="text-text-secondary">
              For all billing and refund enquiries:{" "}
              <a
                href="mailto:support@getfansee.com"
                className="text-brand-primary underline hover:no-underline"
              >
                support@getfansee.com
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
