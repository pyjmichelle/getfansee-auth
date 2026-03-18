import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "18 U.S.C. § 2257 Compliance Statement - GetFanSee",
  description:
    "Record-keeping requirements compliance statement pursuant to 18 U.S.C. § 2257 and 28 C.F.R. Part 75.",
};

export default function Page2257() {
  return (
    <div className="min-h-dvh bg-bg-base">
      <div className="max-w-4xl mx-auto px-4 py-12 section-block">
        <Link href="/">
          <Button variant="ghost" className="mb-8 hover-bold">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </Link>

        <h1 className="text-4xl font-bold text-brand-primary mb-4">
          18 U.S.C. § 2257 Compliance Statement
        </h1>
        <p className="text-text-secondary mb-8">Record-Keeping Requirements Compliance Statement</p>

        <div className="card-block p-8 prose prose-invert max-w-none space-y-8">
          <p className="text-text-tertiary">Last updated: March 17, 2026</p>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Statement of Compliance</h2>
            <p className="text-text-secondary">
              GetFanSee operates in compliance with the record-keeping requirements established by{" "}
              <strong>18 U.S.C. § 2257</strong> and its implementing regulations at{" "}
              <strong>28 C.F.R. Part 75</strong>, which require producers of sexually explicit
              content to maintain age-verification records for all performers depicted therein.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Creator Verification Requirement</h2>
            <p className="text-text-secondary">
              All content creators (&quot;secondary producers&quot;) who upload sexually explicit
              material to the GetFanSee platform are required, as a condition of using the platform,
              to:
            </p>
            <ul className="list-disc pl-6 text-text-secondary space-y-2 mt-3">
              <li>
                Confirm that they are at least 18 years of age at the time of account creation and
                content upload.
              </li>
              <li>
                Submit valid government-issued photo identification verifying their age and identity
                through our KYC (Know Your Customer) verification process before monetizing any
                content.
              </li>
              <li>
                Warrant, represent, and certify that any performer depicted in content they upload
                was at least 18 years of age at the time the content was produced.
              </li>
              <li>
                Maintain, or ensure that the primary producer maintains, the records required by 18
                U.S.C. § 2257 for all performers depicted in uploaded content, and make such records
                available to the Custodian of Records upon request.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Custodian of Records</h2>
            <p className="text-text-secondary">
              The Custodian of Records for GetFanSee, as required by 18 U.S.C. § 2257 and 28 C.F.R.
              Part 75, may be contacted at the following address:
            </p>
            <div className="mt-4 p-4 card-block bg-surface-raised rounded-xl text-text-secondary space-y-1">
              <p>
                <strong>GetFanSee — Custodian of Records</strong>
              </p>
              <p>Legal Department</p>
              <p>
                Email:{" "}
                <a
                  href="mailto:legal@getfansee.com"
                  className="text-brand-primary underline hover:no-underline"
                >
                  legal@getfansee.com
                </a>
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Platform Role</h2>
            <p className="text-text-secondary">
              GetFanSee is a secondary producer as defined by 18 U.S.C. § 2257(h)(2)(B)(vii) with
              respect to content uploaded by third-party creators. GetFanSee does not produce or
              direct any content. All content is created independently by creators who have agreed
              to our{" "}
              <Link href="/terms" className="text-brand-primary underline hover:no-underline">
                Terms of Service
              </Link>{" "}
              and our{" "}
              <Link
                href="/terms#prohibited-content"
                className="text-brand-primary underline hover:no-underline"
              >
                Content Guidelines
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Enforcement</h2>
            <p className="text-text-secondary">
              Content found to violate our age-verification policies is subject to immediate
              removal. Creators found to have uploaded content involving performers under the age of
              18 will be permanently banned, and the matter will be reported to the National Center
              for Missing and Exploited Children (NCMEC) and relevant law enforcement agencies.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Exemption Notice</h2>
            <p className="text-text-secondary">
              Pursuant to 28 C.F.R. § 75.6, certain content may be exempt from the inspection
              requirements of this section. Any content that does not contain any visual depiction
              of actual sexually explicit conduct as defined in 18 U.S.C. § 2256(2)(A) is exempt
              from the requirements of 18 U.S.C. § 2257.
            </p>
          </section>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
