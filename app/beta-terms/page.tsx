import { Metadata } from "next";
import Link from "next/link";
import { LegalPageShell } from "@/components/legal-page-shell";
import {
  LEGAL_COMPANY_NAME,
  LEGAL_CONTACT_EMAIL,
  PLATFORM_NAME,
  SUPPORT_CONTACT_EMAIL,
} from "@/lib/constants/legal";

export const metadata: Metadata = {
  title: "Beta Program Terms - GetFanSee",
  description:
    "Terms for the GetFanSee Alpha/Beta program: Founding Creator 0% commission, referral rewards, Founding Fan credit, external links and crypto payments.",
  alternates: { canonical: "/beta-terms" },
};

export default function BetaTermsPage() {
  return (
    <LegalPageShell title="Beta Program Terms">
      <div className="card-block p-8 prose prose-invert max-w-none space-y-8">
        <p className="text-text-tertiary">
          These Beta Program Terms supplement the {PLATFORM_NAME}{" "}
          <Link href="/terms" className="text-wine-text underline hover:no-underline">
            Terms of Service
          </Link>{" "}
          and apply during the Alpha and Beta phases of the Service operated by {LEGAL_COMPANY_NAME}
          . Where these terms conflict with the Terms of Service, these terms control for the
          programs described below.
        </p>

        <section>
          <h2 className="text-h2 mb-4">1. Platform Phases</h2>
          <ul className="list-disc pl-6 text-text-secondary space-y-2">
            <li>
              <strong className="text-text-primary">Alpha (current phase):</strong> In-platform
              payments are disabled. Browsing, following, and saving creators is free. Creators may
              display admin-approved links to external platforms. Any purchase you make on an
              external platform is between you and that platform — {PLATFORM_NAME} does not process,
              guarantee, or refund such purchases.
            </li>
            <li>
              <strong className="text-text-primary">Beta:</strong> In-platform payments launch.
              Founding Creator commission benefits (Section 2) begin at the Beta payments launch
              date.
            </li>
            <li>
              <strong className="text-text-primary">General Availability (GA):</strong> Standard
              pricing applies — creators keep 80% of eligible revenue and the platform retains a 20%
              fee, as described on the{" "}
              <Link href="/pricing" className="text-wine-text underline hover:no-underline">
                Pricing page
              </Link>
              .
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-h2 mb-4">2. Founding Creator Program</h2>
          <ul className="list-disc pl-6 text-text-secondary space-y-2">
            <li>
              Creators who complete identity verification (KYC) during the Alpha phase are
              designated <strong className="text-text-primary">Founding Creators</strong> and
              receive a permanent profile badge.
            </li>
            <li>
              Founding Creators pay{" "}
              <strong className="text-text-primary">0% platform commission</strong> on eligible
              in-platform revenue for a base period of{" "}
              <strong className="text-text-primary">3 months</strong>, starting on the Beta payments
              launch date.
            </li>
            <li>
              The 0% window can be extended through the referral program (Section 3) by up to{" "}
              <strong className="text-text-primary">3 additional months</strong> (maximum 6 months
              total).
            </li>
            <li>
              Payment processor or network fees charged by third parties are not platform commission
              and may still apply.
            </li>
            <li>
              After the 0% window ends, the then-current standard platform fee applies. Founding
              Creator status does not exempt any account from the Terms of Service, Creator Rules,
              or content policies.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-h2 mb-4">3. Creator Referral Program</h2>
          <ul className="list-disc pl-6 text-text-secondary space-y-2">
            <li>
              Eligibility: creators who have completed KYC and enrolled in the Ambassador program
              receive a personal referral link/code.
            </li>
            <li>
              A referral is <strong className="text-text-primary">qualified</strong> when the
              referred creator (a) signs up through the referral link, (b) completes KYC, and (c)
              publishes their first content.
            </li>
            <li>
              <strong className="text-text-primary">Non-cash reward:</strong> every 5 qualified
              referrals extend the referrer&apos;s Beta 0% commission window by 1 month, capped at
              +3 months.
            </li>
            <li>
              <strong className="text-text-primary">Cash reward:</strong> 5% of the referred
              creator&apos;s eligible in-platform revenue is accrued for 12 months from attribution.
              Accrued amounts are estimates,{" "}
              <strong className="text-text-primary">
                are not payable during Alpha, and become payable only after Beta withdrawals launch
              </strong>
              , subject to identity verification and admin review.
            </li>
            <li>
              Self-referrals, fake accounts, incentivized signups without genuine intent, and other
              fraudulent activity void the related rewards and may result in removal from the
              program.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-h2 mb-4">4. Founding Fan Credit</h2>
          <ul className="list-disc pl-6 text-text-secondary space-y-2">
            <li>
              Fans who meet all of the following during the Alpha phase are eligible for a one-time{" "}
              <strong className="text-text-primary">$5 promotional wallet credit</strong>, granted
              when Beta payments launch: (a) registered during Alpha with a verified email and
              completed age verification; (b) followed at least 10 creators; (c) were active on at
              least 20 distinct days (measured by server-side activity records).
            </li>
            <li>
              Limited to the <strong className="text-text-primary">first 1,000</strong> eligible
              accounts, one per person. Accounts that are banned, suspended, or flagged for
              fraudulent or automated activity are excluded.
            </li>
            <li>
              The credit is a promotional balance: it is{" "}
              <strong className="text-text-primary">
                not withdrawable, not transferable, has no cash value
              </strong>
              , and expires 90 days after it is granted.
            </li>
            <li>
              This is a behavior-based promotion, not a sweepstakes or lottery. We reserve the right
              to modify or terminate the promotion at any time before credits are granted.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-h2 mb-4">5. External Links Disclaimer</h2>
          <p className="text-text-secondary">
            Creator profiles may include links to third-party platforms. These links are reviewed
            against a domain allowlist before display, but {PLATFORM_NAME} does not operate,
            endorse, or assume responsibility for external sites. Purchases, subscriptions, or
            interactions on external platforms are governed solely by those platforms&apos; terms —{" "}
            {PLATFORM_NAME} cannot process refunds or resolve disputes for them.
          </p>
        </section>

        <section>
          <h2 className="text-h2 mb-4">6. Cryptocurrency Payments (if enabled)</h2>
          <ul className="list-disc pl-6 text-text-secondary space-y-2">
            <li>
              If and when cryptocurrency top-ups are enabled, they are processed by a third-party
              payment gateway. Supported currencies and networks are listed at checkout.
            </li>
            <li>
              Cryptocurrency transactions are irreversible.{" "}
              <strong className="text-text-primary">
                Completed crypto top-ups cannot be refunded to fiat
              </strong>
              ; any qualifying refunds are issued as wallet balance. See the{" "}
              <Link href="/refund" className="text-wine-text underline hover:no-underline">
                Refund Policy
              </Link>
              .
            </li>
            <li>
              Blockchain network fees are borne by the payer. Third-party gateway fees are disclosed
              at checkout and are not platform commission.
            </li>
            <li>Crypto payments are unavailable in restricted jurisdictions.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-h2 mb-4">7. Changes and Contact</h2>
          <p className="text-text-secondary">
            We may update these Beta Program Terms as the Service evolves; material changes will be
            announced in-product or by email. Questions: {SUPPORT_CONTACT_EMAIL} (support) or{" "}
            {LEGAL_CONTACT_EMAIL} (legal).
          </p>
        </section>
      </div>
    </LegalPageShell>
  );
}
