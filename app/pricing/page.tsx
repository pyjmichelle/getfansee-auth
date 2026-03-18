import { Metadata } from "next";
import Link from "next/link";
import { CheckCircle, Info, CreditCard, Sparkles, Users, Shield } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Pricing - GetFanSee",
  description:
    "Transparent pricing for GetFanSee — subscription tiers, pay-per-view, and creator earnings.",
};

const fanFeatures = [
  "Access all free creator posts",
  "Follow unlimited creators",
  "Direct messaging (limited)",
  "Browse creator profiles",
];

const subscriberFeatures = [
  "Full access to a creator's exclusive content",
  "Unlock all subscriber-only posts & photos",
  "Unlock all subscriber-only videos",
  "Priority DMs with your subscribed creators",
  "Cancel anytime — no hidden fees",
];

const creatorFeatures = [
  "Set your own monthly subscription price",
  "Sell pay-per-view posts & videos",
  "Keep 80% of all earnings",
  "Creator analytics dashboard",
  "Direct messaging with fans",
  "Payout every month (minimum threshold applies)",
];

export default function PricingPage() {
  return (
    <div className="min-h-dvh bg-bg-base flex flex-col">
      <div className="flex-1 max-w-5xl mx-auto px-4 py-12 section-block w-full">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-text-primary mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-text-secondary text-lg max-w-2xl mx-auto">
            No surprise charges. No hidden fees. You always see exactly what you&apos;ll pay before
            confirming a purchase — and what will appear on your bank statement.
          </p>
        </div>

        {/* Billing Descriptor Notice */}
        <div className="card-block bg-brand-accent/10 border border-brand-accent/20 rounded-xl p-4 flex gap-3 items-start mb-10">
          <CreditCard className="w-5 h-5 text-brand-accent shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-brand-accent mb-0.5">
              Bank Statement Descriptor
            </p>
            <p className="text-sm text-text-secondary">
              All charges from GetFanSee will appear on your bank or credit card statement as{" "}
              <strong className="text-text-primary font-mono">GETFANSEE.COM</strong>. You will
              always receive an email receipt after every transaction.
            </p>
          </div>
        </div>

        {/* Fan / Free Tier */}
        <div className="grid md:grid-cols-2 gap-6 mb-10">
          {/* Free Fan */}
          <div className="card-block p-6 rounded-2xl border border-border-base flex flex-col">
            <div className="mb-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-raised text-text-secondary text-xs font-medium mb-3">
                <Users className="w-3.5 h-3.5" />
                Fan Account
              </div>
              <div className="flex items-end gap-2 mb-1">
                <span className="text-4xl font-bold text-text-primary">Free</span>
              </div>
              <p className="text-text-tertiary text-sm">No credit card required</p>
            </div>

            <ul className="space-y-2.5 flex-1 mb-6">
              {fanFeatures.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-text-secondary">
                  <CheckCircle className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>

            <Link href="/auth">
              <Button variant="outline" className="w-full">
                Create Free Account
              </Button>
            </Link>
          </div>

          {/* Creator Subscription (fan side) */}
          <div className="card-block p-6 rounded-2xl border border-brand-primary/40 bg-brand-primary/5 flex flex-col relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-brand-primary text-white text-xs font-semibold px-3 py-1 rounded-bl-xl">
              Most Popular
            </div>
            <div className="mb-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-primary/10 text-brand-primary text-xs font-medium mb-3">
                <Sparkles className="w-3.5 h-3.5" />
                Creator Subscription
              </div>
              <div className="flex items-end gap-2 mb-1">
                <span className="text-4xl font-bold text-text-primary">Creator&apos;s price</span>
              </div>
              <p className="text-text-tertiary text-sm">
                Each creator sets their own monthly subscription price. Prices typically range from{" "}
                <strong className="text-text-secondary">$4.99 – $49.99 / month</strong>.
              </p>
            </div>

            <ul className="space-y-2.5 flex-1 mb-6">
              {subscriberFeatures.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-text-secondary">
                  <CheckCircle className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>

            <div className="card-block bg-surface-raised rounded-lg p-3 mb-4 text-xs text-text-tertiary">
              <strong className="text-text-secondary">Recurring billing notice:</strong>{" "}
              Subscriptions renew automatically each month on the date you subscribed. You will be
              charged the same amount unless you cancel before the renewal date.
            </div>

            <Link href="/">
              <Button className="w-full">Browse Creators</Button>
            </Link>
          </div>
        </div>

        {/* PPV Section */}
        <div className="card-block p-6 rounded-2xl border border-border-base mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-purple-400" />
            </div>
            <h2 className="text-xl font-semibold text-text-primary">Pay-Per-View (PPV)</h2>
          </div>
          <p className="text-text-secondary mb-4">
            Some creators offer individual posts, photos, or videos for a one-time unlock fee. PPV
            content is in addition to (or instead of) a subscription. Each PPV post clearly displays
            its price before you unlock it.
          </p>
          <div className="grid sm:grid-cols-3 gap-3">
            {[
              { label: "Typical PPV range", value: "$1.99 – $49.99" },
              { label: "Billing", value: "One-time charge" },
              { label: "Refund eligibility", value: "See Refund Policy" },
            ].map((item) => (
              <div key={item.label} className="card-block bg-surface-raised p-3 rounded-lg">
                <p className="text-xs text-text-tertiary mb-1">{item.label}</p>
                <p className="text-sm font-semibold text-text-primary">{item.value}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-text-tertiary mt-4">
            PPV purchases are generally non-refundable once content has been accessed. See our{" "}
            <Link href="/refund" className="text-brand-primary underline hover:no-underline">
              Refund &amp; Cancellation Policy
            </Link>{" "}
            for full details.
          </p>
        </div>

        {/* Creator Earnings */}
        <div className="card-block p-6 rounded-2xl border border-border-base mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
              <Shield className="w-4 h-4 text-green-400" />
            </div>
            <h2 className="text-xl font-semibold text-text-primary">Creator Earnings</h2>
          </div>
          <p className="text-text-secondary mb-6">
            Creators keep <strong className="text-text-primary">80%</strong> of all subscription and
            PPV revenue. GetFanSee retains a{" "}
            <strong className="text-text-primary">20% platform fee</strong> to cover payment
            processing, infrastructure, moderation, and support.
          </p>

          <div className="grid sm:grid-cols-2 gap-4 mb-6">
            <div className="card-block bg-surface-raised p-4 rounded-xl">
              <p className="text-xs text-text-tertiary mb-2">Creator keeps</p>
              <p className="text-3xl font-bold text-green-400">80%</p>
              <p className="text-xs text-text-tertiary mt-1">of every subscription &amp; PPV</p>
            </div>
            <div className="card-block bg-surface-raised p-4 rounded-xl">
              <p className="text-xs text-text-tertiary mb-2">Platform fee</p>
              <p className="text-3xl font-bold text-text-secondary">20%</p>
              <p className="text-xs text-text-tertiary mt-1">
                covers payment processing, hosting &amp; support
              </p>
            </div>
          </div>

          <ul className="space-y-2">
            {creatorFeatures.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm text-text-secondary">
                <CheckCircle className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                {f}
              </li>
            ))}
          </ul>

          <div className="mt-6">
            <Link href="/creator/upgrade">
              <Button variant="outline" className="w-full sm:w-auto">
                Become a Creator →
              </Button>
            </Link>
          </div>
        </div>

        {/* Cancellation & FAQ strip */}
        <div className="card-block bg-surface-raised p-5 rounded-2xl border border-border-base mb-6">
          <div className="flex gap-3 items-start">
            <Info className="w-5 h-5 text-text-tertiary shrink-0 mt-0.5" />
            <div className="space-y-2 text-sm text-text-secondary">
              <p>
                <strong className="text-text-primary">How to cancel:</strong> Log in → go to{" "}
                <Link
                  href="/subscriptions"
                  className="text-brand-primary underline hover:no-underline"
                >
                  My Subscriptions
                </Link>{" "}
                → click Cancel next to any subscription. Cancellation takes effect at the end of
                your current billing period. You will not be charged again.
              </p>
              <p>
                <strong className="text-text-primary">Refunds:</strong> Subscription charges may be
                refunded within 14 days under qualifying circumstances. PPV content is generally
                non-refundable once accessed.{" "}
                <Link href="/refund" className="text-brand-primary underline hover:no-underline">
                  Full Refund Policy →
                </Link>
              </p>
              <p>
                <strong className="text-text-primary">Questions?</strong>{" "}
                <Link href="/faq" className="text-brand-primary underline hover:no-underline">
                  Read the FAQ
                </Link>{" "}
                or{" "}
                <Link href="/support" className="text-brand-primary underline hover:no-underline">
                  contact support
                </Link>
                .
              </p>
            </div>
          </div>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
