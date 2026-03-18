import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Privacy Policy - GetFanSee",
  description: "Privacy Policy for GetFanSee platform",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-dvh bg-bg-base flex flex-col">
      <div className="max-w-4xl mx-auto px-4 py-12 section-block">
        <Link href="/">
          <Button variant="ghost" className="mb-8 hover-bold">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </Link>

        <h1 className="text-4xl font-bold text-brand-primary mb-8">Privacy Policy</h1>

        <div className="card-block p-8 prose prose-invert max-w-none space-y-8">
          <p className="text-text-tertiary">Last updated: January 18, 2026</p>

          <section>
            <h2 className="text-2xl font-semibold mb-4">1. Introduction</h2>
            <p className="text-text-secondary">
              GetFanSee ("we", "our", or "us") is committed to protecting your privacy. This Privacy
              Policy explains how we collect, use, disclose, and safeguard your information when you
              use our service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">2. Information We Collect</h2>

            <h3 className="text-xl font-medium mb-3 mt-6">2.1 Information You Provide</h3>
            <ul className="list-disc pl-6 text-text-secondary space-y-2">
              <li>Account information (email, username, password)</li>
              <li>Profile information (display name, bio, avatar)</li>
              <li>Payment information (processed by third-party payment processors)</li>
              <li>Content you upload (images, videos, text)</li>
              <li>Communications with us or other users</li>
            </ul>

            <h3 className="text-xl font-medium mb-3 mt-6">
              2.2 Information Collected Automatically
            </h3>
            <ul className="list-disc pl-6 text-text-secondary space-y-2">
              <li>Device information (browser type, operating system)</li>
              <li>IP address and location data</li>
              <li>Usage data (pages visited, features used)</li>
              <li>Cookies and similar tracking technologies</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">3. How We Use Your Information</h2>
            <p className="text-text-secondary">We use the information we collect to:</p>
            <ul className="list-disc pl-6 text-text-secondary space-y-2">
              <li>Provide and maintain the Service</li>
              <li>Process transactions and send related information</li>
              <li>Send you technical notices and support messages</li>
              <li>Respond to your comments and questions</li>
              <li>Prevent fraud and enforce our policies</li>
              <li>Analyze usage patterns to improve the Service</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">4. Information Sharing</h2>
            <p className="text-text-secondary">We may share your information with:</p>
            <ul className="list-disc pl-6 text-text-secondary space-y-2">
              <li>Service providers who assist in our operations</li>
              <li>Payment processors for transaction handling</li>
              <li>Law enforcement when required by law</li>
              <li>Other users (only information you make public)</li>
            </ul>
            <p className="text-text-secondary mt-4">
              We do not sell your personal information to third parties.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">5. Data Security</h2>
            <p className="text-text-secondary">
              We implement appropriate technical and organizational measures to protect your
              information, including:
            </p>
            <ul className="list-disc pl-6 text-text-secondary space-y-2">
              <li>Encryption of data in transit and at rest</li>
              <li>Regular security assessments</li>
              <li>Access controls and authentication</li>
              <li>Secure infrastructure hosting</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">6. Data Retention</h2>
            <p className="text-text-secondary">
              We retain your information for as long as your account is active or as needed to
              provide the Service. Upon account deletion:
            </p>
            <ul className="list-disc pl-6 text-text-secondary space-y-2">
              <li>Profile information is deleted within 30 days</li>
              <li>Transaction records are retained for legal compliance</li>
              <li>Uploaded content is deleted unless required for legal purposes</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">7. Your Rights</h2>
            <p className="text-text-secondary">
              Depending on your location, you may have the following rights:
            </p>
            <ul className="list-disc pl-6 text-text-secondary space-y-2">
              <li>Access your personal information</li>
              <li>Correct inaccurate information</li>
              <li>Delete your information</li>
              <li>Object to processing of your information</li>
              <li>Data portability</li>
              <li>Withdraw consent</li>
            </ul>
            <p className="text-text-secondary mt-4">
              To exercise these rights, contact us at{" "}
              <a
                href="mailto:privacy@getfansee.com"
                className="text-brand-primary underline hover:no-underline"
              >
                privacy@getfansee.com
              </a>
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">
              7A. For EEA / UK Users — General Data Protection Regulation (GDPR)
            </h2>
            <p className="text-text-secondary mb-4">
              If you are located in the European Economic Area (EEA) or the United Kingdom, the
              following additional rights and disclosures apply under the General Data Protection
              Regulation (GDPR) or the UK GDPR, as applicable.
            </p>

            <h3 className="text-xl font-medium mb-3 mt-6">Legal Bases for Processing</h3>
            <p className="text-text-secondary mb-2">
              We process your personal data under the following legal bases:
            </p>
            <ul className="list-disc pl-6 text-text-secondary space-y-2">
              <li>
                <strong className="text-text-primary">Contract performance</strong> — to provide the
                Service you have subscribed to (Art. 6(1)(b) GDPR)
              </li>
              <li>
                <strong className="text-text-primary">Legitimate interests</strong> — fraud
                prevention, security, and service improvement (Art. 6(1)(f) GDPR)
              </li>
              <li>
                <strong className="text-text-primary">Legal obligation</strong> — compliance with
                applicable laws including 18 U.S.C. § 2257 and financial record-keeping (Art.
                6(1)(c) GDPR)
              </li>
              <li>
                <strong className="text-text-primary">Consent</strong> — where you have specifically
                agreed (e.g., marketing communications, cookies) (Art. 6(1)(a) GDPR)
              </li>
            </ul>

            <h3 className="text-xl font-medium mb-3 mt-6">Your GDPR Rights</h3>
            <ul className="list-disc pl-6 text-text-secondary space-y-2">
              <li>Right of access (Art. 15)</li>
              <li>Right to rectification (Art. 16)</li>
              <li>Right to erasure / "right to be forgotten" (Art. 17)</li>
              <li>Right to restriction of processing (Art. 18)</li>
              <li>Right to data portability (Art. 20)</li>
              <li>Right to object to processing (Art. 21)</li>
              <li>Rights related to automated decision-making (Art. 22)</li>
              <li>
                Right to withdraw consent at any time (without affecting prior lawful processing)
              </li>
            </ul>

            <h3 className="text-xl font-medium mb-3 mt-6">
              Right to Lodge a Supervisory Authority Complaint
            </h3>
            <p className="text-text-secondary">
              You have the right to lodge a complaint with your local data protection authority
              (e.g., the ICO in the UK, or the relevant national DPA in your EEA country) if you
              believe we have not handled your data appropriately.
            </p>

            <h3 className="text-xl font-medium mb-3 mt-6">Data Protection Contact</h3>
            <p className="text-text-secondary">
              For any GDPR-related requests or questions, contact our privacy team at{" "}
              <a
                href="mailto:privacy@getfansee.com"
                className="text-brand-primary underline hover:no-underline"
              >
                privacy@getfansee.com
              </a>
              . We will respond within 30 days.
            </p>

            <h3 className="text-xl font-medium mb-3 mt-6">International Data Transfers</h3>
            <p className="text-text-secondary">
              Where we transfer personal data outside the EEA or UK, we ensure appropriate
              safeguards are in place, such as Standard Contractual Clauses (SCCs) approved by the
              European Commission, or transfers to countries with an adequacy decision.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">
              7B. For California Residents — California Consumer Privacy Act (CCPA) / CPRA
            </h2>
            <p className="text-text-secondary mb-4">
              If you are a California resident, you have specific rights under the California
              Consumer Privacy Act (CCPA) and California Privacy Rights Act (CPRA).
            </p>

            <h3 className="text-xl font-medium mb-3 mt-6">Your CCPA Rights</h3>
            <ul className="list-disc pl-6 text-text-secondary space-y-2">
              <li>
                <strong className="text-text-primary">Right to Know</strong> — you may request
                information about the categories and specific pieces of personal information we have
                collected, the sources, business purposes, and third parties with whom we share it.
              </li>
              <li>
                <strong className="text-text-primary">Right to Delete</strong> — you may request
                deletion of personal information we have collected, subject to certain exceptions.
              </li>
              <li>
                <strong className="text-text-primary">Right to Correct</strong> — you may request
                correction of inaccurate personal information.
              </li>
              <li>
                <strong className="text-text-primary">Right to Opt-Out of Sale or Sharing</strong> —
                we do <em>not</em> sell your personal information to third parties and do not share
                it for cross-context behavioural advertising purposes.
              </li>
              <li>
                <strong className="text-text-primary">Right to Limit Use of Sensitive PI</strong> —
                you may direct us to limit our use of sensitive personal information.
              </li>
              <li>
                <strong className="text-text-primary">Right to Non-Discrimination</strong> — we will
                not discriminate against you for exercising any CCPA rights.
              </li>
            </ul>

            <h3 className="text-xl font-medium mb-3 mt-6">
              Do Not Sell or Share My Personal Information
            </h3>
            <p className="text-text-secondary">
              GetFanSee does <strong className="text-text-primary">not</strong> sell, rent, or share
              personal information with third parties for monetary consideration or for
              cross-context behavioural advertising. To submit any privacy request, contact us at{" "}
              <a
                href="mailto:privacy@getfansee.com"
                className="text-brand-primary underline hover:no-underline"
              >
                privacy@getfansee.com
              </a>
              .
            </p>

            <h3 className="text-xl font-medium mb-3 mt-6">Submitting a CCPA Request</h3>
            <p className="text-text-secondary">
              To submit a verifiable consumer request, email us at{" "}
              <a
                href="mailto:privacy@getfansee.com"
                className="text-brand-primary underline hover:no-underline"
              >
                privacy@getfansee.com
              </a>{" "}
              with subject line "CCPA Request". We will verify your identity before processing and
              respond within 45 days.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">8. Cookies</h2>
            <p className="text-text-secondary">We use cookies and similar technologies to:</p>
            <ul className="list-disc pl-6 text-text-secondary space-y-2">
              <li>Keep you signed in</li>
              <li>Remember your preferences</li>
              <li>Analyze Service usage</li>
              <li>Verify age confirmation</li>
            </ul>
            <p className="text-text-secondary mt-4">
              You can control cookies through your browser settings.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">9. Children's Privacy</h2>
            <p className="text-text-secondary">
              The Service is not intended for individuals under 18 years of age. We do not knowingly
              collect information from minors. If we learn we have collected information from a
              minor, we will delete that information immediately.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">10. International Transfers</h2>
            <p className="text-text-secondary">
              Your information may be transferred to and processed in countries other than your own.
              We ensure appropriate safeguards are in place for such transfers.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">11. Changes to This Policy</h2>
            <p className="text-text-secondary">
              We may update this Privacy Policy from time to time. We will notify you of significant
              changes by posting the new policy on this page and updating the "Last updated" date.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">12. Contact Us</h2>
            <p className="text-text-secondary">
              If you have questions about this Privacy Policy, please contact us at:
            </p>
            <ul className="list-none pl-0 text-text-secondary space-y-1 mt-4">
              <li>
                Email:{" "}
                <a
                  href="mailto:privacy@getfansee.com"
                  className="text-brand-primary underline hover:no-underline"
                >
                  privacy@getfansee.com
                </a>
              </li>
              <li>
                Or visit our{" "}
                <Link href="/support" className="text-brand-primary underline hover:no-underline">
                  Support page
                </Link>
              </li>
            </ul>
          </section>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
