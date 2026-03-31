import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "About GetFanSee",
  description:
    "Learn about GetFanSee — our mission, legal entity information, and how to contact us.",
};

export default function AboutPage() {
  return (
    <div className="min-h-dvh bg-bg-base">
      <div className="max-w-4xl mx-auto px-4 py-12 section-block">
        <Link href="/">
          <Button variant="ghost" className="mb-8 hover-bold">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </Link>

        <h1 className="text-4xl font-bold text-brand-primary mb-8">About GetFanSee</h1>

        <div className="prose prose-invert max-w-none space-y-6">
          <div className="card-block p-8 rounded-2xl">
            <h2 className="text-2xl font-semibold mb-4">Our Mission</h2>
            <p className="text-text-secondary">
              GetFanSee is a premium adult creator subscription platform designed to help creators
              monetise their content directly and build closer connections with their fans. We
              provide a safe, transparent, and compliant environment for adult content creators and
              their subscribers.
            </p>
          </div>

          <div className="card-block p-8 rounded-2xl">
            <h2 className="text-2xl font-semibold mb-4">Legal Entity</h2>
            <div className="bg-surface-raised p-6 rounded-xl space-y-3 text-text-secondary">
              <div className="flex flex-col sm:flex-row sm:gap-4">
                <span className="font-semibold text-text-primary min-w-[180px]">Platform Name</span>
                <span>GetFanSee</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:gap-4">
                <span className="font-semibold text-text-primary min-w-[180px]">
                  Registered Company
                </span>
                <span>GetFanSee Pty Ltd</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:gap-4">
                <span className="font-semibold text-text-primary min-w-[180px]">
                  Registered Address
                </span>
                <span>Suite 1, Level 2, 123 Tech Street, Sydney NSW 2000, Australia</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:gap-4">
                <span className="font-semibold text-text-primary min-w-[180px]">
                  Company Registration
                </span>
                <span>ACN 000 000 000 (Australian Company Number)</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:gap-4">
                <span className="font-semibold text-text-primary min-w-[180px]">
                  Governing Jurisdiction
                </span>
                <span>New South Wales, Australia</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:gap-4">
                <span className="font-semibold text-text-primary min-w-[180px]">Website</span>
                <span>getfansee.com</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:gap-4">
                <span className="font-semibold text-text-primary min-w-[180px]">
                  General Enquiries
                </span>
                <a
                  href="mailto:hello@getfansee.com"
                  className="text-brand-primary underline hover:no-underline"
                >
                  hello@getfansee.com
                </a>
              </div>
              <div className="flex flex-col sm:flex-row sm:gap-4">
                <span className="font-semibold text-text-primary min-w-[180px]">Legal</span>
                <a
                  href="mailto:legal@getfansee.com"
                  className="text-brand-primary underline hover:no-underline"
                >
                  legal@getfansee.com
                </a>
              </div>
              <div className="flex flex-col sm:flex-row sm:gap-4">
                <span className="font-semibold text-text-primary min-w-[180px]">Support</span>
                <a
                  href="mailto:support@getfansee.com"
                  className="text-brand-primary underline hover:no-underline"
                >
                  support@getfansee.com
                </a>
              </div>
              <div className="flex flex-col sm:flex-row sm:gap-4">
                <span className="font-semibold text-text-primary min-w-[180px]">
                  DMCA / Copyright
                </span>
                <a
                  href="mailto:dmca@getfansee.com"
                  className="text-brand-primary underline hover:no-underline"
                >
                  dmca@getfansee.com
                </a>
              </div>
              <div className="flex flex-col sm:flex-row sm:gap-4">
                <span className="font-semibold text-text-primary min-w-[180px]">Privacy</span>
                <a
                  href="mailto:privacy@getfansee.com"
                  className="text-brand-primary underline hover:no-underline"
                >
                  privacy@getfansee.com
                </a>
              </div>
            </div>
            <p className="text-text-tertiary text-sm mt-3">
              * Company registration details are provided for legal compliance purposes. Please
              contact us at{" "}
              <a
                href="mailto:legal@getfansee.com"
                className="text-brand-primary underline hover:no-underline"
              >
                legal@getfansee.com
              </a>{" "}
              to verify any information required for payment processor applications or regulatory
              submissions.
            </p>
          </div>

          <div className="card-block p-8 rounded-2xl">
            <h2 className="text-2xl font-semibold mb-4">Our Commitment to Safety</h2>
            <p className="text-text-secondary mb-4">
              GetFanSee is committed to operating a safe and legal platform. Our key safeguards
              include:
            </p>
            <ul className="list-disc pl-6 text-text-secondary space-y-2">
              <li>
                <strong className="text-text-primary">Age Verification:</strong> All users must
                confirm they are 18+ before accessing any content. Creators must complete a KYC
                (Know Your Customer) identity verification process before monetising content.
              </li>
              <li>
                <strong className="text-text-primary">Content Moderation:</strong> All uploaded
                content is subject to review. We have an active moderation team that reviews
                reported content and enforces our Content Guidelines.
              </li>
              <li>
                <strong className="text-text-primary">Fraud Controls:</strong> We employ automated
                financial auditing, transaction monitoring, and abuse detection systems to protect
                our users.
              </li>
              <li>
                <strong className="text-text-primary">Record Keeping:</strong> We maintain records
                in compliance with applicable laws, including{" "}
                <Link href="/2257" className="text-brand-primary underline hover:no-underline">
                  18 U.S.C. § 2257
                </Link>
                .
              </li>
              <li>
                <strong className="text-text-primary">DMCA Compliance:</strong> We respond promptly
                to valid copyright takedown notices. See our{" "}
                <Link href="/dmca" className="text-brand-primary underline hover:no-underline">
                  DMCA Policy
                </Link>
                .
              </li>
            </ul>
          </div>

          <div className="card-block p-8 rounded-2xl">
            <h2 className="text-2xl font-semibold mb-4">Legal Documents</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { href: "/terms", label: "Terms of Service" },
                { href: "/privacy", label: "Privacy Policy" },
                { href: "/refund", label: "Refund & Cancellation Policy" },
                { href: "/dmca", label: "DMCA / Copyright Policy" },
                { href: "/2257", label: "18 U.S.C. § 2257 Statement" },
                { href: "/faq", label: "FAQ" },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="bg-surface-raised p-4 text-brand-primary text-sm font-medium hover:bg-white/10 transition-colors rounded-xl"
                >
                  {link.label} →
                </Link>
              ))}
            </div>
          </div>

          <div className="card-block p-8 rounded-2xl">
            <h2 className="text-2xl font-semibold mb-4">Contact Us</h2>
            <p className="text-text-secondary">
              For any enquiries, support requests, or legal matters, please contact us through our{" "}
              <Link href="/support" className="text-brand-primary underline hover:no-underline">
                Support page
              </Link>{" "}
              or at{" "}
              <a
                href="mailto:hello@getfansee.com"
                className="text-brand-primary underline hover:no-underline"
              >
                hello@getfansee.com
              </a>
              .
            </p>
          </div>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
