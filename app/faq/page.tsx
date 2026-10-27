import { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LegalPageShell } from "@/components/legal-page-shell";
import { SUPPORT_CONTACT_EMAIL } from "@/lib/constants/legal";

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
    q: "How will wallet funding appear on my card statement?",
    a: (
      <>
        Wallet funding is handled by a payment partner. The final amount, provider fees and
        statement descriptor are displayed before confirmation. If you see a charge you don&apos;t
        recognise, please{" "}
        <Link href="/support" className="text-wine-text underline hover:no-underline">
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
        A subscription purchase grants access to a creator&apos;s subscriber-only content for 30
        days. The current MVP does not renew automatically. You can see active access periods and
        their end dates on your{" "}
        <Link href="/subscriptions" className="text-wine-text underline hover:no-underline">
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
        <Link href="/me/wallet" className="text-wine-text underline hover:no-underline">
          Wallet page
        </Link>{" "}
        and choose an available funding amount. During Beta, the planned fixed tiers are $20, $50
        and $100. The payment provider will show its fees before confirmation.
      </>
    ),
  },
  {
    q: "Will I receive a receipt for my purchases?",
    a: "Yes. After every completed subscription or PPV purchase, we send an order confirmation email to your registered address. It includes the amount deducted from your GetFanSee wallet and what you purchased.",
  },
];

const cancellationFAQ: FAQItem[] = [
  {
    q: "Do I need to cancel a subscription?",
    a: (
      <>
        No recurring charge is scheduled in the current MVP. Your access ends automatically after 30
        days. You can review the end date on your{" "}
        <Link href="/subscriptions" className="text-wine-text underline hover:no-underline">
          Subscriptions page
        </Link>
        .
      </>
    ),
  },
  {
    q: "What happens after I cancel?",
    a: "Your access continues until the end of the 30-day period you purchased. No automatic renewal charge is made.",
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
        <Link href="/refund" className="text-wine-text underline hover:no-underline">
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
        <Link href="/support" className="text-wine-text underline hover:no-underline">
          Support page
        </Link>{" "}
        or by emailing{" "}
        <a
          href={`mailto:${SUPPORT_CONTACT_EMAIL}`}
          className="text-wine-text underline hover:no-underline"
        >
          {SUPPORT_CONTACT_EMAIL}
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
        <Link href="/creator/upgrade" className="text-wine-text underline hover:no-underline">
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
        <Link href="/privacy" className="text-wine-text underline hover:no-underline">
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
        <Link href="/dmca" className="text-wine-text underline hover:no-underline">
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
        <Link href="/support" className="text-wine-text underline hover:no-underline">
          Support page
        </Link>{" "}
        or email{" "}
        <a
          href={`mailto:${SUPPORT_CONTACT_EMAIL}`}
          className="text-wine-text underline hover:no-underline"
        >
          {SUPPORT_CONTACT_EMAIL}
        </a>
        . We respond within 24 hours on weekdays.
      </>
    ),
  },
];

function FAQSection({ title, items }: { title: string; items: FAQItem[] }) {
  return (
    <section className="space-y-4">
      <h2 className="text-h2 text-text-primary">{title}</h2>
      <div className="space-y-3">
        {items.map((item, i) => (
          <div key={i} className="card-block p-6">
            <h3 className="font-semibold text-text-primary mb-2">{item.q}</h3>
            <p className="text-text-secondary text-small leading-relaxed">{item.a}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function FAQPage() {
  return (
    <LegalPageShell
      title="Frequently Asked Questions"
      subtitle={
        <>
          Can&apos;t find the answer you&apos;re looking for?{" "}
          <Link href="/support" className="text-wine-text underline hover:no-underline">
            Contact our support team
          </Link>
          .
        </>
      }
    >
      <div className="space-y-10">
        <FAQSection title="Billing & Payments" items={billingFAQ} />
        <FAQSection title="Cancellations" items={cancellationFAQ} />
        <FAQSection title="Refunds" items={refundFAQ} />
        <FAQSection title="Account & Safety" items={accountFAQ} />
      </div>

      <div className="mt-12 card-block p-6 bg-[var(--wine-tint)] border-[var(--border-wine)]/20 text-center">
        <p className="text-text-secondary mb-3">Still need help?</p>
        <Link href="/support">
          <Button variant="default">Contact Support</Button>
        </Link>
      </div>
    </LegalPageShell>
  );
}
