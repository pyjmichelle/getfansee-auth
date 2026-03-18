import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Mail, FileText, AlertCircle } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "DMCA & Copyright - GetFanSee",
  description: "DMCA takedown request and copyright policy for GetFanSee",
};

export default function DMCAPage() {
  return (
    <div className="min-h-dvh bg-bg-base">
      <div className="max-w-4xl mx-auto px-4 py-12 section-block">
        <Link href="/">
          <Button variant="ghost" className="mb-8 hover-bold">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </Link>

        <h1 className="text-4xl font-bold mb-4">DMCA & Copyright Policy</h1>
        <p className="text-text-tertiary text-sm mb-2">Last updated: March 17, 2026</p>
        <p className="text-text-secondary mb-8">
          GetFanSee respects intellectual property rights and responds to valid DMCA takedown
          requests.
        </p>

        <div className="space-y-8">
          {/* Quick Submit Card */}
          <Card className="card-block border-brand-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-brand-primary" />
                Submit a DMCA Takedown Request
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-text-secondary">
                To submit a DMCA takedown request, please send an email to:
              </p>
              <a
                href="mailto:dmca@getfansee.com"
                className="inline-flex items-center gap-2 text-brand-primary font-semibold text-lg hover:underline"
              >
                dmca@getfansee.com
              </a>
              <p className="text-sm text-text-secondary">
                Please include all required information listed below in your request.
              </p>
            </CardContent>
          </Card>

          {/* Requirements Section */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Required Information
            </h2>
            <p className="text-text-secondary mb-4">
              Your DMCA takedown notice must include the following information:
            </p>
            <ol className="list-decimal pl-6 text-text-secondary space-y-3">
              <li>
                <strong className="text-brand-primary">
                  Identification of the copyrighted work
                </strong>{" "}
                - A description of the copyrighted work you claim has been infringed. If multiple
                works are covered, you may provide a representative list.
              </li>
              <li>
                <strong className="text-brand-primary">
                  Identification of the infringing material
                </strong>{" "}
                - The URL(s) or specific location of the content you claim is infringing, with
                enough detail for us to locate it.
              </li>
              <li>
                <strong className="text-brand-primary">Your contact information</strong> - Your full
                legal name, mailing address, telephone number, and email address.
              </li>
              <li>
                <strong className="text-brand-primary">Good faith statement</strong> - A statement
                that you have a good faith belief that the use of the material is not authorized by
                the copyright owner, its agent, or the law.
              </li>
              <li>
                <strong className="text-brand-primary">Accuracy statement</strong> - A statement
                that the information in your notice is accurate, and under penalty of perjury, that
                you are authorized to act on behalf of the copyright owner.
              </li>
              <li>
                <strong className="text-brand-primary">Electronic or physical signature</strong> -
                Your electronic or physical signature.
              </li>
            </ol>
          </section>

          {/* Email Template */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">Email Template</h2>
            <Card className="bg-surface-raised/30">
              <CardContent className="pt-6">
                <pre className="text-sm text-text-secondary whitespace-pre-wrap font-mono">
                  {`Subject: DMCA Takedown Request

To: dmca@getfansee.com

Dear GetFanSee DMCA Agent,

I am writing to request removal of content that infringes my copyright.

1. COPYRIGHTED WORK:
[Describe your original work that has been infringed]

2. INFRINGING CONTENT URL(S):
[Provide the full URL(s) to the infringing content on GetFanSee]

3. CONTACT INFORMATION:
Name: [Your full legal name]
Address: [Your mailing address]
Phone: [Your phone number]
Email: [Your email address]

4. GOOD FAITH STATEMENT:
I have a good faith belief that the use of the described 
material in the manner complained of is not authorized by 
the copyright owner, its agent, or the law.

5. ACCURACY STATEMENT:
I swear, under penalty of perjury, that the information in 
this notification is accurate and that I am the copyright 
owner, or am authorized to act on behalf of the owner, of 
an exclusive right that is allegedly infringed.

Signature: [Your electronic signature]
Date: [Current date]`}
                </pre>
              </CardContent>
            </Card>
          </section>

          {/* Counter-Notice Section */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">Counter-Notification</h2>
            <p className="text-text-secondary mb-4">
              If you believe your content was wrongly removed due to a DMCA notice, you may submit a
              counter-notification. Your counter-notice must include:
            </p>
            <ul className="list-disc pl-6 text-text-secondary space-y-2">
              <li>Your physical or electronic signature</li>
              <li>Identification of the removed material and its previous location</li>
              <li>
                A statement under penalty of perjury that you believe the material was removed by
                mistake
              </li>
              <li>Your name, address, phone number, and consent to jurisdiction</li>
            </ul>
          </section>

          {/* Warning Section */}
          <Card className="border-error/30 bg-error/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-error">
                <AlertCircle className="w-5 h-5" />
                Important Notice
              </CardTitle>
            </CardHeader>
            <CardContent className="text-text-secondary space-y-3">
              <p>
                <strong className="text-brand-primary">False claims:</strong> Filing a false DMCA
                notice or counter-notice is illegal. Under Section 512(f) of the DMCA, you may be
                liable for damages if you knowingly misrepresent material or activity as infringing.
              </p>
              <p>
                <strong className="text-brand-primary">Repeat infringers:</strong> GetFanSee
                maintains a policy of terminating accounts of users who are found to be repeat
                infringers.
              </p>
            </CardContent>
          </Card>

          {/* Response Time */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">Response Time</h2>
            <p className="text-text-secondary">
              We aim to respond to valid DMCA takedown requests within <strong>48-72 hours</strong>.
              Upon receiving a valid request, we will:
            </p>
            <ul className="list-disc pl-6 text-text-secondary space-y-2 mt-4">
              <li>Remove or disable access to the allegedly infringing content</li>
              <li>Notify the user who posted the content</li>
              <li>Provide the user with a copy of the takedown notice</li>
              <li>Allow the user to submit a counter-notice if applicable</li>
            </ul>
          </section>

          {/* Contact Section */}
          <section className="pt-8 border-t">
            <h2 className="text-2xl font-semibold mb-4">DMCA Agent Contact</h2>
            <div className="text-text-secondary space-y-2">
              <p>
                <strong className="text-brand-primary">Email:</strong> dmca@getfansee.com
              </p>
              <p>
                <strong className="text-brand-primary">Subject Line:</strong> DMCA Takedown Request
              </p>
            </div>
            <p className="text-sm text-text-secondary mt-4">
              For general inquiries, please visit our{" "}
              <Link href="/support" className="text-brand-primary underline hover:no-underline">
                Support page
              </Link>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
