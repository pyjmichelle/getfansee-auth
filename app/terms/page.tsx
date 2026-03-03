import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "@/lib/icons";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Terms of Service - GetFanSee",
  description: "Terms of Service for GetFanSee platform",
};

export default function TermsPage() {
  return (
    <div className="min-h-dvh bg-bg-base">
      <div className="max-w-4xl mx-auto px-4 py-12 section-block">
        <Link href="/">
          <Button variant="ghost" className="mb-8 hover-bold">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </Link>

        <h1 className="text-4xl font-bold text-brand-primary mb-8">Terms of Service</h1>

        <div className="card-block p-8 prose prose-invert max-w-none space-y-8">
          <p className="text-text-tertiary">Last updated: January 18, 2026</p>

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
            <h2 className="text-2xl font-semibold mb-4">5. Payments and Refunds</h2>
            <p className="text-text-secondary font-semibold">
              All purchases on GetFanSee are final. No refunds will be provided for digital goods,
              including but not limited to:
            </p>
            <ul className="list-disc pl-6 text-text-secondary space-y-2">
              <li>Wallet recharges</li>
              <li>Subscription purchases</li>
              <li>Pay-per-view content unlocks</li>
              <li>Tips and donations</li>
            </ul>
            <p className="text-text-secondary mt-4">
              Chargebacks may result in account suspension or termination.
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

          <section>
            <h2 className="text-2xl font-semibold mb-4">7. Prohibited Content</h2>
            <p className="text-text-secondary">The following content is strictly prohibited:</p>
            <ul className="list-disc pl-6 text-text-secondary space-y-2">
              <li>Content involving minors</li>
              <li>Non-consensual content</li>
              <li>Illegal activities</li>
              <li>Harassment or hate speech</li>
              <li>Content that infringes intellectual property rights</li>
              <li>Malware or harmful code</li>
            </ul>
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
              <li>No refunds will be provided for unused wallet balance</li>
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
            <h2 className="text-2xl font-semibold mb-4">13. Contact</h2>
            <p className="text-text-secondary">
              For questions about these Terms, contact us at:{" "}
              <a
                href="mailto:legal@getfansee.com"
                className="text-brand-primary underline hover:no-underline"
              >
                legal@getfansee.com
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
