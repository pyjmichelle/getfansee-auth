import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { SiteFooter } from "@/components/site-footer";
import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_EFFECTIVE_DATE,
  SUPPORT_CONTACT_EMAIL,
} from "@/lib/constants/legal";

export const metadata: Metadata = {
  title: "Terms of Service - GetFanSee",
  description: "Terms of Service for GetFanSee platform",
};

export default function TermsPage() {
  return (
    <div className="min-h-dvh bg-bg-base flex flex-col">
      <div className="max-w-4xl mx-auto px-4 py-12 section-block">
        <Link href="/">
          <Button variant="ghost" className="mb-8 hover-bold">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </Link>

        <h1 className="text-4xl font-bold text-brand-primary mb-8">Terms of Service</h1>

        <div className="card-block p-8 prose prose-invert max-w-none space-y-8">
          <p className="text-text-tertiary">Last updated: {LEGAL_EFFECTIVE_DATE}</p>

          <section>
            <h2 className="text-2xl font-semibold mb-4">1. Acceptance of Terms</h2>
            <p className="text-text-secondary">
              By accessing or using GetFanSee ("the Service"), you agree to be bound by these Terms
              of Service. If you do not agree to these terms, please do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">2. Age Requirement</h2>
            <p className="text-text-secondary">
              You must be at least 18 years old to use the Service. By using the Service, you
              represent and warrant that you are at least 18 years of age. The Service contains
              adult content that may not be suitable for minors.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">3. Account Registration</h2>
            <p className="text-text-secondary">
              To access certain features of the Service, you must register for an account. You agree
              to:
            </p>
            <ul className="list-disc pl-6 text-text-secondary space-y-2">
              <li>Provide accurate and complete information</li>
              <li>Maintain the security of your account credentials</li>
              <li>Notify us immediately of any unauthorized access</li>
              <li>Accept responsibility for all activities under your account</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">4. User Content</h2>
            <p className="text-text-secondary">
              Users are solely responsible for content they upload to the Service. By uploading
              content, you:
            </p>
            <ul className="list-disc pl-6 text-text-secondary space-y-2">
              <li>Warrant that you own or have rights to the content</li>
              <li>Grant GetFanSee a license to display and distribute the content</li>
              <li>Agree not to upload illegal or prohibited content</li>
              <li>Accept that content may be reviewed for policy compliance</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">5. Payments, Subscriptions & Refunds</h2>
            <p className="text-text-secondary">
              All transactions on GetFanSee are processed securely. By completing a purchase, you
              agree to the billing terms described below. Our full{" "}
              <Link href="/refund" className="text-brand-primary underline hover:no-underline">
                Refund & Cancellation Policy
              </Link>{" "}
              is available separately.
            </p>

            <h3 className="text-lg font-semibold mt-4 mb-2">Subscriptions</h3>
            <ul className="list-disc pl-6 text-text-secondary space-y-2">
              <li>
                Subscriptions are billed on a recurring monthly basis from the date of purchase.
              </li>
              <li>
                You may cancel your subscription at any time from your{" "}
                <Link
                  href="/subscriptions"
                  className="text-brand-primary underline hover:no-underline"
                >
                  Subscriptions page
                </Link>
                . Cancellation takes effect at the end of the current billing period.
              </li>
              <li>
                Refunds for subscription charges may be issued at our discretion within 48 hours of
                a billing date in cases of technical error or duplicate charge.
              </li>
            </ul>

            <h3 className="text-lg font-semibold mt-4 mb-2">Pay-Per-View & Wallet Purchases</h3>
            <ul className="list-disc pl-6 text-text-secondary space-y-2">
              <li>
                Pay-per-view unlocks and wallet recharges are generally non-refundable once the
                digital content has been accessed.
              </li>
              <li>
                Refund requests due to technical failures, duplicate charges, or content that was
                materially misrepresented will be reviewed on a case-by-case basis. To request a
                refund, contact{" "}
                <a
                  href={`mailto:${SUPPORT_CONTACT_EMAIL}`}
                  className="text-brand-primary underline hover:no-underline"
                >
                  {SUPPORT_CONTACT_EMAIL}
                </a>{" "}
                within 14 days of the charge.
              </li>
            </ul>

            <p className="text-text-secondary mt-4">
              Initiating a chargeback without first contacting our support team may result in
              account suspension. We are committed to resolving disputes fairly and promptly.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">6. Creator Payouts</h2>
            <p className="text-text-secondary">
              Creators receive payouts subject to platform fees and minimum thresholds. GetFanSee
              reserves the right to withhold payments pending investigation of policy violations.
              See our Beta Payout Policy for current terms.
            </p>
          </section>

          <section id="prohibited-content">
            <h2 className="text-2xl font-semibold mb-4">7. Prohibited Content & Acceptable Use</h2>
            <p className="text-text-secondary mb-4">
              GetFanSee is committed to providing a safe and legal platform. The following content
              and activities are strictly prohibited. Violations may result in immediate account
              termination, content removal, and referral to law enforcement authorities.
            </p>

            <h3 className="text-lg font-semibold mt-4 mb-2">
              Absolutely Prohibited (Zero Tolerance)
            </h3>
            <ul className="list-disc pl-6 text-text-secondary space-y-2">
              <li>
                <strong className="text-text-primary">Content involving minors</strong> — any
                content that sexually exploits, depicts, or endangers individuals under 18 years of
                age. We report all such content to the National Center for Missing &amp; Exploited
                Children (NCMEC) and relevant law enforcement.
              </li>
              <li>
                <strong className="text-text-primary">Non-consensual content</strong> — sharing
                intimate images or recordings without the subject's explicit consent.
              </li>
              <li>
                <strong className="text-text-primary">Content depicting real violence</strong> —
                gratuitous gore, torture, or real acts of violence.
              </li>
              <li>
                <strong className="text-text-primary">Bestiality</strong> — sexual content involving
                animals.
              </li>
              <li>
                <strong className="text-text-primary">Illegal activities</strong> — content that
                promotes, facilitates, or depicts illegal acts, including drug trafficking, weapons
                distribution, or human trafficking.
              </li>
            </ul>

            <h3 className="text-lg font-semibold mt-4 mb-2">Also Prohibited</h3>
            <ul className="list-disc pl-6 text-text-secondary space-y-2">
              <li>
                Harassment, bullying, or targeted hate speech based on protected characteristics
              </li>
              <li>Content that infringes intellectual property rights (copyright, trademark)</li>
              <li>Malware, phishing, or any malicious code</li>
              <li>Spam or unsolicited commercial communications</li>
              <li>Impersonation of other individuals or entities</li>
              <li>Content designed to defraud or deceive other users</li>
            </ul>

            <h3 className="text-lg font-semibold mt-4 mb-2">Creator Responsibilities</h3>
            <p className="text-text-secondary">
              All creators must verify that every person appearing in their content is at least 18
              years of age and has provided written consent. Creators must maintain records as
              required by applicable law, including 18 U.S.C. § 2257. See our{" "}
              <Link href="/2257" className="text-brand-primary underline hover:no-underline">
                2257 Compliance Statement
              </Link>{" "}
              for details.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">8. Intellectual Property</h2>
            <p className="text-text-secondary">
              GetFanSee respects intellectual property rights. If you believe content infringes your
              copyright, please submit a DMCA notice through our designated process at{" "}
              <Link href="/dmca" className="text-brand-primary underline hover:no-underline">
                /dmca
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">9. Termination</h2>
            <p className="text-text-secondary">
              We reserve the right to suspend or terminate accounts that violate these Terms. Upon
              termination:
            </p>
            <ul className="list-disc pl-6 text-text-secondary space-y-2">
              <li>Access to the Service will be revoked</li>
              <li>Pending creator payouts may be forfeited if due to policy violation</li>
              <li>
                Unused wallet balance refund eligibility will be assessed per our Refund Policy
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">10. Disclaimer of Warranties</h2>
            <p className="text-text-secondary">
              THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND. WE DISCLAIM ALL
              WARRANTIES, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY AND FITNESS FOR A PARTICULAR
              PURPOSE.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">11. Limitation of Liability</h2>
            <p className="text-text-secondary">
              IN NO EVENT SHALL GETFANSEE BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
              CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF THE SERVICE.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">12. Changes to Terms</h2>
            <p className="text-text-secondary">
              We may update these Terms at any time. Continued use of the Service after changes
              constitutes acceptance of the modified Terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">
              13. Governing Law and Dispute Resolution
            </h2>
            <p className="text-text-secondary">
              These Terms and any dispute, claim, or controversy arising out of or relating to these
              Terms, the Services, your account, your use of the Services, any subscription, paid
              content, creator payout, content moderation decision, or any relationship between you
              and GetFanSee shall be governed by and construed in accordance with the laws of the
              State of Wyoming, United States, without regard to its conflict of law principles.
            </p>
            <p className="text-text-secondary mt-4">
              Subject to any mandatory consumer protection laws that may apply in your place of
              residence, you and GetFanSee agree that the state and federal courts located in
              Wyoming shall have exclusive jurisdiction over any dispute, claim, or controversy
              arising out of or relating to these Terms or the Services. You and GetFanSee each
              consent to the personal jurisdiction and venue of such courts.
            </p>
            <p className="text-text-secondary mt-4">
              Nothing in this section prevents either party from seeking injunctive or equitable
              relief in any court of competent jurisdiction to protect intellectual property rights,
              confidential information, platform security, payment integrity, user safety, or to
              address unauthorized use, misuse, or distribution of content.
            </p>
            <p className="text-text-secondary mt-4">
              If you are a consumer residing in a jurisdiction where applicable law does not permit
              exclusive jurisdiction or venue in Wyoming, this section applies only to the maximum
              extent permitted by applicable law.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">14. Contact</h2>
            <p className="text-text-secondary">
              For questions about these Terms, contact us at:{" "}
              <a
                href={`mailto:${LEGAL_CONTACT_EMAIL}`}
                className="text-brand-primary underline hover:no-underline"
              >
                {LEGAL_CONTACT_EMAIL}
              </a>
            </p>
          </section>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
