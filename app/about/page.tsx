import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { SiteFooter } from "@/components/site-footer";
import {
  COMPLIANCE_CONTACT_EMAIL,
  CREATORS_CONTACT_EMAIL,
  DMCA_CONTACT_EMAIL,
  LEGAL_COMPANY_NAME,
  LEGAL_COMPANY_REGISTRATION,
  LEGAL_CONTACT_EMAIL,
  LEGAL_EFFECTIVE_DATE,
  LEGAL_GOVERNING_JURISDICTION,
  LEGAL_REGISTERED_ADDRESS,
  PLATFORM_NAME,
  PRIVACY_CONTACT_EMAIL,
  SAFETY_CONTACT_EMAIL,
  SOCIALS_CONTACT_EMAIL,
  SUPPORT_CONTACT_EMAIL,
} from "@/lib/constants/legal";

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
                <span>{PLATFORM_NAME}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:gap-4">
                <span className="font-semibold text-text-primary min-w-[180px]">
                  Registered Company
                </span>
                <span>{LEGAL_COMPANY_NAME}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:gap-4">
                <span className="font-semibold text-text-primary min-w-[180px]">
                  Registered Address
                </span>
                <span>{LEGAL_REGISTERED_ADDRESS}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:gap-4">
                <span className="font-semibold text-text-primary min-w-[180px]">
                  Company Registration
                </span>
                <span>{LEGAL_COMPANY_REGISTRATION}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:gap-4">
                <span className="font-semibold text-text-primary min-w-[180px]">
                  Effective Date
                </span>
                <span>{LEGAL_EFFECTIVE_DATE}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:gap-4">
                <span className="font-semibold text-text-primary min-w-[180px]">
                  Governing Jurisdiction
                </span>
                <span>{LEGAL_GOVERNING_JURISDICTION}</span>
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
                  href={`mailto:${SOCIALS_CONTACT_EMAIL}`}
                  className="text-brand-primary underline hover:no-underline"
                >
                  {SOCIALS_CONTACT_EMAIL}
                </a>
              </div>
              <div className="flex flex-col sm:flex-row sm:gap-4">
                <span className="font-semibold text-text-primary min-w-[180px]">Support</span>
                <a
                  href={`mailto:${SUPPORT_CONTACT_EMAIL}`}
                  className="text-brand-primary underline hover:no-underline"
                >
                  {SUPPORT_CONTACT_EMAIL}
                </a>
              </div>
              <div className="flex flex-col sm:flex-row sm:gap-4">
                <span className="font-semibold text-text-primary min-w-[180px]">Creators</span>
                <a
                  href={`mailto:${CREATORS_CONTACT_EMAIL}`}
                  className="text-brand-primary underline hover:no-underline"
                >
                  {CREATORS_CONTACT_EMAIL}
                </a>
              </div>
              <div className="flex flex-col sm:flex-row sm:gap-4">
                <span className="font-semibold text-text-primary min-w-[180px]">Legal</span>
                <a
                  href={`mailto:${LEGAL_CONTACT_EMAIL}`}
                  className="text-brand-primary underline hover:no-underline"
                >
                  {LEGAL_CONTACT_EMAIL}
                </a>
              </div>
              <div className="flex flex-col sm:flex-row sm:gap-4">
                <span className="font-semibold text-text-primary min-w-[180px]">Compliance</span>
                <a
                  href={`mailto:${COMPLIANCE_CONTACT_EMAIL}`}
                  className="text-brand-primary underline hover:no-underline"
                >
                  {COMPLIANCE_CONTACT_EMAIL}
                </a>
              </div>
              <div className="flex flex-col sm:flex-row sm:gap-4">
                <span className="font-semibold text-text-primary min-w-[180px]">Privacy</span>
                <a
                  href={`mailto:${PRIVACY_CONTACT_EMAIL}`}
                  className="text-brand-primary underline hover:no-underline"
                >
                  {PRIVACY_CONTACT_EMAIL}
                </a>
              </div>
              <div className="flex flex-col sm:flex-row sm:gap-4">
                <span className="font-semibold text-text-primary min-w-[180px]">
                  DMCA / Copyright
                </span>
                <a
                  href={`mailto:${DMCA_CONTACT_EMAIL}`}
                  className="text-brand-primary underline hover:no-underline"
                >
                  {DMCA_CONTACT_EMAIL}
                </a>
              </div>
              <div className="flex flex-col sm:flex-row sm:gap-4">
                <span className="font-semibold text-text-primary min-w-[180px]">
                  Trust &amp; Safety
                </span>
                <a
                  href={`mailto:${SAFETY_CONTACT_EMAIL}`}
                  className="text-brand-primary underline hover:no-underline"
                >
                  {SAFETY_CONTACT_EMAIL}
                </a>
              </div>
            </div>
            <p className="text-text-tertiary text-sm mt-3">
              * Company registration details are provided for legal compliance purposes. Please
              contact us at{" "}
              <a
                href={`mailto:${LEGAL_CONTACT_EMAIL}`}
                className="text-brand-primary underline hover:no-underline"
              >
                {LEGAL_CONTACT_EMAIL}
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
              or email us at{" "}
              <a
                href={`mailto:${SOCIALS_CONTACT_EMAIL}`}
                className="text-brand-primary underline hover:no-underline"
              >
                {SOCIALS_CONTACT_EMAIL}
              </a>{" "}
              (general) or{" "}
              <a
                href={`mailto:${SUPPORT_CONTACT_EMAIL}`}
                className="text-brand-primary underline hover:no-underline"
              >
                {SUPPORT_CONTACT_EMAIL}
              </a>{" "}
              (support).
            </p>
          </div>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
