import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "FAQ - GetFanSee",
  description:
    "Frequently asked questions about GetFanSee billing, subscriptions, cancellations, refunds, and account management.",
};

interface FAQItem {
  q: string;
  a: React.ReactNode;
}

const billingFAQ: FAQItem[] = [
  {
    q: "What will appear on my bank or credit card statement?",
    a: (
      <>
        Charges from GetFanSee appear on your statement as{" "}
        <strong className="text-text-primary">GETFANSEE.COM</strong>. If you see a charge you don't
        recognise, please{" "}
        <Link href="/support" className="text-brand-primary underline hover:no-underline">
          contact support
        </Link>{" "}
        before disputing with your bank.
      </>
    ),
  },
  {
    q: "How do subscriptions work?",
    a: (
      <>
        Subscriptions are billed on a recurring monthly basis from the date you subscribe. You get
        access to all of a creator's subscriber-only content for 30 days. The charge recurs
        automatically unless you cancel. You can see all active subscriptions and their next renewal
        dates on your{" "}
        <Link href="/subscriptions" className="text-brand-primary underline hover:no-underline">
          Subscriptions page
        </Link>
        .
      </>
    ),
  },
  {
    q: "How do Pay-Per-View (PPV) purchases work?",
    a: "PPV purchases unlock a single piece of content permanently. The cost is deducted from your GetFanSee wallet. You can view your purchase history at any time from your Purchases page.",
  },
  {
    q: "How do I add funds to my wallet?",
    a: (
      <>
        Visit your{" "}
        <Link href="/me/wallet" className="text-brand-primary underline hover:no-underline">
          Wallet page
        </Link>{" "}
        and choose a recharge amount ($10, $25, $50, $100, or $200). Larger recharges include a
        bonus credit.
      </>
    ),
  },
  {
    q: "Will I receive a receipt for my purchases?",
    a: "Yes. After every subscription or PPV purchase, we automatically send an order confirmation email to your registered address. The email includes the amount charged, what you purchased, the billing descriptor (GETFANSEE.COM), and a link to manage your subscription.",
  },
];

const cancellationFAQ: FAQItem[] = [
  {
    q: "How do I cancel a subscription?",
    a: (
      <>
        Log in and go to your{" "}
        <Link href="/subscriptions" className="text-brand-primary underline hover:no-underline">
          Subscriptions page
        </Link>
        . Find the subscription you want to cancel and click the <strong>Cancel</strong> button.
        Confirm in the dialog. Cancellation takes effect at the end of your current billing period —
        you keep access until then. There are no cancellation fees.
      </>
    ),
  },
  {
    q: "What happens after I cancel?",
    a: "Your access to the creator's content continues until the end of the billing period you've already paid for. After that, you will no longer be charged and will lose subscriber-only access.",
  },
  {
    q: "Can I resubscribe after cancelling?",
    a: "Yes. You can resubscribe to any creator at any time by visiting their profile page.",
  },
];

const refundFAQ: FAQItem[] = [
  {
    q: "Can I get a refund?",
    a: (
      <>
        Yes, in qualifying circumstances. We offer refunds for duplicate charges, billing errors,
        technical failures that prevented content access, and charges made after a cancellation. See
        our full{" "}
        <Link href="/refund" className="text-brand-primary underline hover:no-underline">
          Refund Policy
        </Link>{" "}
        for details.
      </>
    ),
  },
  {
    q: "How do I request a refund?",
    a: (
      <>
        Contact us within 14 days of the charge via our{" "}
        <Link href="/support" className="text-brand-primary underline hover:no-underline">
          Support page
        </Link>{" "}
        or by emailing{" "}
        <a
          href="mailto:support@getfansee.com"
          className="text-brand-primary underline hover:no-underline"
        >
          support@getfansee.com
        </a>
        . Include your account email, transaction date, and amount. We aim to respond within 2
        business days.
      </>
    ),
  },
  {
    q: "How long do refunds take?",
    a: "Once approved, refunds are processed within 5–10 business days back to your original payment method.",
  },
];

const accountFAQ: FAQItem[] = [
  {
    q: "How do I become a creator?",
    a: (
      <>
        Go to{" "}
        <Link href="/creator/upgrade" className="text-brand-primary underline hover:no-underline">
          Creator Upgrade
        </Link>{" "}
        and complete the KYC identity verification process. You must be 18+ and provide valid
        government-issued ID.
      </>
    ),
  },
  {
    q: "Is my personal information safe?",
    a: (
      <>
        Yes. All data is encrypted in transit (HTTPS) and at rest. We do not sell your personal
        information. See our{" "}
        <Link href="/privacy" className="text-brand-primary underline hover:no-underline">
          Privacy Policy
        </Link>{" "}
        for full details.
      </>
    ),
  },
  {
    q: "How do I report content or a user?",
    a: (
      <>
        Use the report button on any post or profile. For copyright infringement, see our{" "}
        <Link href="/dmca" className="text-brand-primary underline hover:no-underline">
          DMCA Policy
        </Link>
        .
      </>
    ),
  },
  {
    q: "I can't find an answer to my question. What do I do?",
    a: (
      <>
        Contact our support team via the{" "}
        <Link href="/support" className="text-brand-primary underline hover:no-underline">
          Support page
        </Link>{" "}
        or email{" "}
        <a
          href="mailto:support@getfansee.com"
          className="text-brand-primary underline hover:no-underline"
        >
          support@getfansee.com
        </a>
        . We respond within 24 hours on weekdays.
      </>
    ),
  },
];

function FAQSection({ title, items }: { title: string; items: FAQItem[] }) {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold text-text-primary">{title}</h2>
      <div className="space-y-3">
        {items.map((item, i) => (
          <div key={i} className="card-block p-6">
            <h3 className="font-semibold text-text-primary mb-2">{item.q}</h3>
            <p className="text-text-secondary text-sm leading-relaxed">{item.a}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function FAQPage() {
  return (
    <div className="min-h-dvh bg-bg-base">
      <div className="max-w-4xl mx-auto px-4 py-12 section-block">
        <Link href="/">
          <Button variant="ghost" className="mb-8 hover-bold">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </Link>

        <h1 className="text-4xl font-bold text-brand-primary mb-3">Frequently Asked Questions</h1>
        <p className="text-text-secondary mb-10">
          Can&apos;t find the answer you&apos;re looking for?{" "}
          <Link href="/support" className="text-brand-primary underline hover:no-underline">
            Contact our support team
          </Link>
          .
        </p>

        <div className="space-y-10">
          <FAQSection title="Billing & Payments" items={billingFAQ} />
          <FAQSection title="Cancellations" items={cancellationFAQ} />
          <FAQSection title="Refunds" items={refundFAQ} />
          <FAQSection title="Account & Safety" items={accountFAQ} />
        </div>

        <div className="mt-12 card-block p-6 bg-brand-primary-alpha-10 border-brand-primary/20 text-center">
          <p className="text-text-secondary mb-3">Still need help?</p>
          <Link href="/support">
            <Button variant="default" className="text-white shadow-glow hover-bold">
              Contact Support
            </Button>
          </Link>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
