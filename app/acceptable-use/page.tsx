import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ShieldAlert, AlertTriangle, CheckCircle } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Acceptable Use Policy - GetFanSee",
  description:
    "GetFanSee Acceptable Use and Content Guidelines Policy — what creators and users can and cannot post.",
};

export default function AcceptableUsePage() {
  return (
    <div className="min-h-dvh bg-bg-base flex flex-col">
      <div className="flex-1 max-w-4xl mx-auto px-4 py-12 section-block w-full">
        <Link href="/">
          <Button variant="ghost" className="mb-8 hover-bold">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </Link>

        <h1 className="text-4xl font-bold text-brand-primary mb-2">
          Acceptable Use &amp; Content Guidelines
        </h1>
        <p className="text-text-tertiary mb-8">Last updated: January 18, 2026</p>

        <div className="card-block p-8 prose prose-invert max-w-none space-y-8">
          <section>
            <p className="text-text-secondary">
              GetFanSee is committed to providing a safe, legal, and consensual platform for adult
              content creators and their subscribers. This Acceptable Use Policy ("AUP") governs
              what content creators may post, what activities users may engage in, and how the
              platform enforces these standards.
            </p>
            <p className="text-text-secondary mt-3">
              This policy applies to all users of the GetFanSee platform, including creators,
              subscribers, and visitors. Violations may result in immediate content removal, account
              suspension or termination, withholding of payouts, and referral to law enforcement
              where required by law.
            </p>
            <p className="text-text-secondary mt-3">
              This policy supplements and incorporates our{" "}
              <Link href="/terms" className="text-brand-primary underline hover:no-underline">
                Terms of Service
              </Link>
              . In the event of a conflict, the Terms of Service prevail.
            </p>
          </section>

          {/* Zero Tolerance */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <ShieldAlert className="w-6 h-6 text-red-400 shrink-0" />
              <h2 className="text-2xl font-semibold text-red-400">
                Absolutely Prohibited — Zero Tolerance
              </h2>
            </div>
            <p className="text-text-secondary mb-4">
              The following content is strictly forbidden under any circumstances. There are no
              exceptions. Accounts found posting or distributing such content will be permanently
              terminated, all earnings forfeited, and all relevant information reported to law
              enforcement and applicable authorities.
            </p>

            <div className="space-y-4">
              <div className="card-block bg-red-950/20 border border-red-900/30 p-4 rounded-xl">
                <h3 className="font-semibold text-red-300 mb-2">
                  1. Content Involving Minors (CSAM)
                </h3>
                <p className="text-text-secondary text-sm">
                  Any content — visual, audio, written, or otherwise — that sexually exploits,
                  depicts, endangers, or sexualises individuals under 18 years of age. GetFanSee
                  reports all such content immediately to the{" "}
                  <strong className="text-text-primary">
                    National Center for Missing &amp; Exploited Children (NCMEC)
                  </strong>{" "}
                  via CyberTipline, and to relevant law enforcement agencies. This is a legal
                  obligation we take with absolute seriousness.
                </p>
              </div>

              <div className="card-block bg-red-950/20 border border-red-900/30 p-4 rounded-xl">
                <h3 className="font-semibold text-red-300 mb-2">2. Non-Consensual Content</h3>
                <p className="text-text-secondary text-sm">
                  Sharing, distributing, or threatening to share intimate images, videos, or
                  recordings of another person without their explicit, documented, and ongoing
                  consent. This includes "revenge porn" and similar non-consensual intimate image
                  abuse (NCII).
                </p>
              </div>

              <div className="card-block bg-red-950/20 border border-red-900/30 p-4 rounded-xl">
                <h3 className="font-semibold text-red-300 mb-2">
                  3. Bestiality &amp; Animal Content
                </h3>
                <p className="text-text-secondary text-sm">
                  Any sexual content depicting or involving animals.
                </p>
              </div>

              <div className="card-block bg-red-950/20 border border-red-900/30 p-4 rounded-xl">
                <h3 className="font-semibold text-red-300 mb-2">
                  4. Extreme Real Violence &amp; Gore
                </h3>
                <p className="text-text-secondary text-sm">
                  Content depicting actual acts of torture, real gore, real violence against persons
                  or animals, or snuff content. Fictional depictions must not be realistic enough to
                  be mistaken for real violence.
                </p>
              </div>

              <div className="card-block bg-red-950/20 border border-red-900/30 p-4 rounded-xl">
                <h3 className="font-semibold text-red-300 mb-2">5. Illegal Activity Content</h3>
                <p className="text-text-secondary text-sm">
                  Content that promotes, facilitates, depicts, or solicits participation in illegal
                  activities, including but not limited to: drug trafficking, human trafficking,
                  arms distribution, sexual exploitation, or any activity that constitutes a
                  criminal offence in the jurisdiction of the creator, subject, or GetFanSee.
                </p>
              </div>
            </div>
          </section>

          {/* Also Prohibited */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-yellow-400 shrink-0" />
              <h2 className="text-2xl font-semibold">Also Prohibited</h2>
            </div>
            <p className="text-text-secondary mb-4">
              The following content and behaviours are prohibited on the platform and may result in
              content removal, warnings, account suspension, or permanent termination depending on
              severity and history.
            </p>

            <div className="grid gap-3">
              {[
                {
                  title: "Harassment & Targeted Abuse",
                  desc: "Content designed to harass, intimidate, bully, or threaten specific individuals. Targeted hate speech based on protected characteristics including race, ethnicity, religion, gender, sexual orientation, or disability.",
                },
                {
                  title: "Intellectual Property Infringement",
                  desc: "Uploading content to which you do not hold the rights, including images, videos, music, and written material owned by third parties, without a valid licence or fair use justification.",
                },
                {
                  title: "Malware & Malicious Code",
                  desc: "Distributing viruses, ransomware, spyware, or any code designed to damage, disrupt, or gain unauthorised access to systems.",
                },
                {
                  title: "Spam & Unsolicited Commercial Messages",
                  desc: "Sending bulk unsolicited messages to other users, artificially inflating engagement metrics, or using the platform for automated commercial solicitation.",
                },
                {
                  title: "Impersonation",
                  desc: "Creating accounts or content that impersonates another person, brand, or entity in a manner that is deceptive or misleading.",
                },
                {
                  title: "Deceptive or Fraudulent Content",
                  desc: "Content designed to mislead users about what they are purchasing, deceptive subscription traps, fake testimonials, or any other form of fraud targeting platform users.",
                },
                {
                  title: "Doxxing",
                  desc: "Revealing or threatening to reveal another person's private identifying information (address, phone number, workplace, etc.) without their consent.",
                },
                {
                  title: "Glorification of Terrorism or Mass Violence",
                  desc: "Content that promotes, glorifies, or recruits for terrorist organisations or movements advocating mass violence.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="card-block bg-surface-raised p-4 rounded-xl border border-border-base"
                >
                  <h3 className="font-semibold text-text-primary mb-1">{item.title}</h3>
                  <p className="text-text-secondary text-sm">{item.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Creator Responsibilities */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle className="w-6 h-6 text-green-400 shrink-0" />
              <h2 className="text-2xl font-semibold">Creator Responsibilities</h2>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Age Verification of All Subjects</h3>
                <p className="text-text-secondary">
                  Before monetising content, all creators must complete identity and age
                  verification via our KYC process. Additionally, creators must verify that{" "}
                  <strong className="text-text-primary">
                    every person appearing in their content is at least 18 years of age
                  </strong>{" "}
                  and has provided written consent to appear in that content. Creators must maintain
                  these records as required by applicable law.
                </p>
                <p className="text-text-secondary mt-2">
                  See our{" "}
                  <Link href="/2257" className="text-brand-primary underline hover:no-underline">
                    18 U.S.C. § 2257 Compliance Statement
                  </Link>{" "}
                  for record-keeping requirements applicable to US-based creators or content
                  subjects.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">Content Accuracy &amp; Transparency</h3>
                <p className="text-text-secondary">
                  Creators must accurately describe their content. Subscription or PPV content must
                  materially match its description and preview. Misleading content descriptions that
                  result in user complaints will be reviewed and may result in content removal and
                  refund obligations.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">
                  No Watermarks from Competing Platforms
                </h3>
                <p className="text-text-secondary">
                  Content uploaded to GetFanSee may not contain watermarks, usernames, or
                  promotional links directing users to competing subscription platforms.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">Compliance with All Applicable Laws</h3>
                <p className="text-text-secondary">
                  Creators are solely responsible for ensuring their content complies with all laws
                  applicable in their jurisdiction, including those governing adult content,
                  obscenity, taxation, and labour. GetFanSee does not provide legal advice.
                </p>
              </div>
            </div>
          </section>

          {/* Content Moderation */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">Content Moderation &amp; Enforcement</h2>
            <p className="text-text-secondary mb-3">
              GetFanSee maintains an active content moderation programme, combining automated
              detection tools with human review. We employ the following enforcement measures:
            </p>
            <ul className="list-disc pl-6 text-text-secondary space-y-2">
              <li>
                <strong className="text-text-primary">Automated screening</strong> — all uploaded
                content is scanned using hash-matching technology (including PhotoDNA) to detect
                known CSAM and other prohibited material before publication.
              </li>
              <li>
                <strong className="text-text-primary">Human review</strong> — reported content is
                reviewed by trained moderation staff within 48–72 hours of a report being submitted.
              </li>
              <li>
                <strong className="text-text-primary">User reporting</strong> — any user or creator
                can report content via the report button on any post or profile. Reports are
                reviewed promptly.
              </li>
              <li>
                <strong className="text-text-primary">Appeals process</strong> — creators whose
                content is removed may appeal the decision by contacting{" "}
                <a
                  href="mailto:content@getfansee.com"
                  className="text-brand-primary underline hover:no-underline"
                >
                  content@getfansee.com
                </a>{" "}
                within 30 days of the removal notice.
              </li>
            </ul>
          </section>

          {/* Reporting */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">How to Report a Violation</h2>
            <p className="text-text-secondary mb-3">
              If you believe content on GetFanSee violates this policy:
            </p>
            <ol className="list-decimal pl-6 text-text-secondary space-y-2">
              <li>
                Use the <strong className="text-text-primary">Report</strong> button on the relevant
                post or profile.
              </li>
              <li>
                For urgent matters (CSAM or imminent harm), email{" "}
                <a
                  href="mailto:urgent@getfansee.com"
                  className="text-brand-primary underline hover:no-underline"
                >
                  urgent@getfansee.com
                </a>{" "}
                directly. We treat all such reports as P0 and respond within 24 hours.
              </li>
              <li>
                For copyright infringement, please use our formal{" "}
                <Link href="/dmca" className="text-brand-primary underline hover:no-underline">
                  DMCA Takedown Process
                </Link>
                .
              </li>
              <li>
                For general support, visit our{" "}
                <Link href="/support" className="text-brand-primary underline hover:no-underline">
                  Support page
                </Link>
                .
              </li>
            </ol>
          </section>

          {/* Contact */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">Contact</h2>
            <p className="text-text-secondary">
              For questions about this Acceptable Use Policy, contact our Trust &amp; Safety team
              at:{" "}
              <a
                href="mailto:safety@getfansee.com"
                className="text-brand-primary underline hover:no-underline"
              >
                safety@getfansee.com
              </a>
            </p>
          </section>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
