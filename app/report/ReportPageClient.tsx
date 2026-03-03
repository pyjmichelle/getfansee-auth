"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, CheckCircle, AlertCircle, Lock, FileText } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { PageShell } from "@/components/page-shell";

type ReportType = "post" | "comment" | "user";

interface ReportPageClientProps {
  initialType: ReportType;
  initialId: string;
  postId?: string;
  creatorId?: string;
}

const REPORT_REASONS = [
  { id: "spam", label: "Spam or Scam", description: "Misleading or repetitive content" },
  {
    id: "explicit",
    label: "Undisclosed Explicit Content",
    description: "Adult content not properly labeled",
  },
  {
    id: "minors",
    label: "Content Involving Minors",
    description: "Sexualization or harm to minors",
  },
  {
    id: "harassment",
    label: "Harassment or Bullying",
    description: "Targeted harassment or abuse",
  },
  {
    id: "intellectual",
    label: "Intellectual Property Violation",
    description: "Unauthorized use of copyrighted material",
  },
  { id: "violence", label: "Violence or Threats", description: "Threatening or violent content" },
  { id: "other", label: "Other", description: "Something else not listed above" },
];

export default function ReportPageClient({
  initialType,
  initialId,
  postId,
  creatorId,
}: ReportPageClientProps) {
  const router = useRouter();
  const [selectedReason, setSelectedReason] = useState<string>("");
  const [details, setDetails] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReason) {
      setError("Please select a reason for your report.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: initialType,
          id: initialId,
          postId: postId || initialId,
          creatorId,
          reason: selectedReason,
          details: details.trim(),
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to submit report");
      }

      setSuccess(true);
    } catch (err) {
      console.error("[ReportPageClient] submit error:", err);
      setError(err instanceof Error ? err.message : "Failed to submit report. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <PageShell user={null} maxWidth="md">
        <div className="flex items-center justify-center py-16">
          <div className="card-block p-10 text-center w-full">
            <div className="w-16 h-16 mx-auto rounded-full bg-success/10 flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-success" aria-hidden="true" />
            </div>
            <h2 className="text-xl font-bold mb-2 text-text-primary">Report Submitted</h2>
            <p className="text-text-secondary text-sm mb-6">
              Thank you for helping keep GetFanSee safe. Our moderation team will review your report
              within 24–48 hours.
            </p>
            <Button
              variant="subscribe-gradient"
              className="w-full min-h-[44px] shadow-glow active:scale-95"
              onClick={() => router.back()}
              aria-label="Return to previous page"
            >
              Go Back
            </Button>
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell user={null} maxWidth="4xl">
      <div className="py-4">
        {/* Page Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-error/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-error" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Report Content</h1>
            <p className="text-sm text-text-tertiary">Help us maintain a safe community</p>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6" role="alert">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Two-column layout on Desktop */}
        <div className="md:grid md:grid-cols-[1fr_280px] md:gap-8 md:items-start">
          {/* Form */}
          <form onSubmit={handleSubmit} aria-label="Report content form">
            {/* Reason Selection */}
            <div className="card-block p-5 mb-4">
              <Label className="text-sm font-semibold text-text-primary mb-3 block">
                Reason for Report <span className="text-error">*</span>
              </Label>
              <fieldset>
                <legend className="sr-only">Select a reason for your report</legend>
                <div className="space-y-2">
                  {REPORT_REASONS.map((reason) => {
                    const isSelected = selectedReason === reason.id;
                    return (
                      <label
                        key={reason.id}
                        className={cn(
                          "flex items-start gap-3 p-3 rounded-xl cursor-pointer hover-bold transition-all min-h-[44px]",
                          "border border-transparent focus-within:border-brand-primary/50",
                          isSelected
                            ? "bg-brand-primary/10 border-brand-primary/30"
                            : "hover:bg-surface-raised"
                        )}
                        aria-label={`${reason.label}: ${reason.description}`}
                      >
                        <input
                          type="radio"
                          name="reason"
                          value={reason.id}
                          checked={isSelected}
                          onChange={() => setSelectedReason(reason.id)}
                          className="mt-0.5 accent-brand-primary"
                        />
                        <div>
                          <p
                            className={cn(
                              "text-sm font-medium",
                              isSelected ? "text-brand-primary" : "text-text-primary"
                            )}
                          >
                            {reason.label}
                          </p>
                          <p className="text-xs text-text-tertiary">{reason.description}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            </div>

            {/* Additional Details */}
            <div className="card-block p-5 mb-4">
              <Label
                htmlFor="report-details"
                className="text-sm font-semibold text-text-primary mb-2 block"
              >
                Additional Details{" "}
                <span className="text-text-tertiary font-normal">(optional)</span>
              </Label>
              <Textarea
                id="report-details"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Provide any additional context that might help our moderation team..."
                className="min-h-[100px] resize-none bg-surface-raised border-border-base text-text-primary placeholder:text-text-tertiary focus:border-brand-primary/50 transition-colors"
                maxLength={1000}
              />
              <p className="text-xs text-text-tertiary mt-1.5 text-right">{details.length}/1000</p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                type="button"
                variant="outline"
                className="sm:flex-1 min-h-[44px] active:scale-95 hover:bg-surface-raised focus-visible:ring-2 focus-visible:ring-brand-primary"
                onClick={() => router.back()}
                aria-label="Cancel and go back"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="subscribe-gradient"
                disabled={!selectedReason || isSubmitting}
                className="sm:flex-1 min-h-[44px] shadow-glow active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                aria-label={isSubmitting ? "Submitting report…" : "Submit report"}
              >
                {isSubmitting ? "Submitting…" : "Submit Report"}
              </Button>
            </div>
          </form>

          {/* Info Panel — Mobile: after form, Desktop: sticky sidebar */}
          <aside
            className="mt-6 md:mt-0 space-y-4 md:sticky md:top-20"
            aria-label="Report information"
          >
            {/* Anonymous */}
            <div className="card-block p-4">
              <div className="flex items-center gap-2 mb-2">
                <Lock className="w-4 h-4 text-brand-primary" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-text-primary">Anonymous Report</h2>
              </div>
              <p className="text-xs text-text-tertiary">
                Your identity is kept confidential. The reported user will not know who submitted
                this report.
              </p>
            </div>

            {/* Process */}
            <div className="card-block p-4">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-4 h-4 text-brand-accent" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-text-primary">Review Process</h2>
              </div>
              <ol className="space-y-2">
                {[
                  "You submit a report with a reason",
                  "Our team reviews within 24–48 hours",
                  "Content is actioned if it violates our guidelines",
                  "You may receive a follow-up if needed",
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-text-tertiary">
                    <span className="flex-shrink-0 w-4 h-4 rounded-full bg-brand-primary/10 text-brand-primary text-[10px] font-bold flex items-center justify-center mt-0.5">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          </aside>
        </div>
      </div>
    </PageShell>
  );
}
