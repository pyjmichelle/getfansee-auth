import { Metadata } from "next";
import Link from "next/link";
import { LegalPageShell } from "@/components/legal-page-shell";
import {
  COMPLIANCE_CONTACT_EMAIL,
  CREATORS_CONTACT_EMAIL,
  PLATFORM_NAME,
} from "@/lib/constants/legal";

export const metadata: Metadata = {
  title: "Creator Rules - GetFanSee",
  description:
    "Rules for creators on GetFanSee: identity verification, content standards, external links policy, and enforcement.",
  alternates: { canonical: "/creator-rules" },
};

export default function CreatorRulesPage() {
  return (
    <LegalPageShell title="Creator Rules">
      <div className="card-block p-8 prose prose-invert max-w-none space-y-8">
        <p className="text-text-tertiary">
          These rules apply to every creator account on {PLATFORM_NAME}, in addition to the{" "}
          <Link href="/terms" className="text-wine-text underline hover:no-underline">
            Terms of Service
          </Link>
          ,{" "}
          <Link href="/acceptable-use" className="text-wine-text underline hover:no-underline">
            Acceptable Use Policy
          </Link>{" "}
          and{" "}
          <Link href="/beta-terms" className="text-wine-text underline hover:no-underline">
            Beta Program Terms
          </Link>
          .
        </p>

        <section>
          <h2 className="text-h2 mb-4">1. Identity Verification (KYC)</h2>
          <ul className="list-disc pl-6 text-text-secondary space-y-2">
            <li>
              Every creator must complete identity verification before publishing content — this
              applies during Alpha as well, even though in-platform payments are disabled.
            </li>
            <li>
              Verification supports our obligations under 18 U.S.C. § 2257 (age and identity records
              for content performers), prevents impersonation of other creators, and backs the
              &ldquo;Verified Creator&rdquo; badge fans rely on.
            </li>
            <li>
              You must be at least 18 years old. Accounts that fail or bypass verification will be
              restricted.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-h2 mb-4">2. Content Standards</h2>
          <ul className="list-disc pl-6 text-text-secondary space-y-2">
            <li>
              You may only upload content that you created or hold full rights to, featuring only
              verified, consenting adults.
            </li>
            <li>
              Every person appearing in your content must be 18+ with records available per our{" "}
              <Link href="/2257" className="text-wine-text underline hover:no-underline">
                2257 Compliance Statement
              </Link>
              .
            </li>
            <li>
              Prohibited content is defined in the Acceptable Use Policy and is enforced without
              exception. Content may be reviewed before or after publication.
            </li>
            <li>
              Misleading previews, deceptive pricing, or bait-and-switch tactics on paid content are
              prohibited.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-h2 mb-4">3. External Links Policy</h2>
          <ul className="list-disc pl-6 text-text-secondary space-y-2">
            <li>
              You may submit up to 5 external links (e.g. OnlyFans, Fansly, Instagram, X, Linktree)
              for display on your public profile.
            </li>
            <li>
              Links are only displayed after admin review against a domain allowlist. Shorteners,
              redirects to non-allowlisted domains, and links to prohibited content are rejected.
            </li>
            <li>
              You are responsible for the destination of your links. Linking to scams, phishing, or
              content that violates our policies results in link removal and may result in account
              action.
            </li>
            <li>
              Business you conduct on external platforms is outside {PLATFORM_NAME} — we do not take
              commission on it, and we cannot mediate disputes about it.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-h2 mb-4">4. Referrals and Promotions</h2>
          <ul className="list-disc pl-6 text-text-secondary space-y-2">
            <li>
              Referral rewards follow the{" "}
              <Link href="/beta-terms" className="text-wine-text underline hover:no-underline">
                Beta Program Terms
              </Link>
              . Fraudulent referrals (self-referrals, fake accounts, bot signups) void rewards.
            </li>
            <li>
              When promoting {PLATFORM_NAME}, do not make income guarantees or misrepresent program
              terms (e.g. &ldquo;0% forever&rdquo;).
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-h2 mb-4">5. Enforcement</h2>
          <p className="text-text-secondary">
            Violations may result in content removal, link removal, loss of Founding Creator or
            referral benefits, suspension, or permanent ban, depending on severity. Appeals:{" "}
            {CREATORS_CONTACT_EMAIL}. Compliance records requests: {COMPLIANCE_CONTACT_EMAIL}.
          </p>
        </section>
      </div>
    </LegalPageShell>
  );
}
