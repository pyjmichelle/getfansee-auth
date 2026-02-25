"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { NavHeader } from "@/components/nav-header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { ensureProfile } from "@/lib/auth";
import { getProfile } from "@/lib/profile";
import { submitReport, type ReportType } from "@/lib/reports";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  Shield,
  Ban,
  AlertCircle,
  MoreHorizontal,
  CheckCircle,
  Loader2,
} from "lucide-react";

const supabase = getSupabaseBrowserClient();

type ReportPageClientProps = {
  initialType: ReportType;
  initialId: string;
};

const REPORT_REASONS = [
  { id: "inappropriate", label: "Inappropriate content", icon: AlertCircle },
  { id: "harassment", label: "Harassment or bullying", icon: AlertTriangle },
  { id: "spam", label: "Spam or misleading", icon: Ban },
  { id: "copyright", label: "Copyright violation", icon: Shield },
  { id: "underage", label: "Underage content", icon: AlertTriangle },
  { id: "violence", label: "Violence or dangerous content", icon: AlertCircle },
  { id: "other", label: "Other", icon: MoreHorizontal },
];

export default function ReportPageClient({ initialType, initialId }: ReportPageClientProps) {
  const router = useRouter();
  const type = initialType;
  const id = initialId;

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [currentUser, setCurrentUser] = useState<{
    username: string;
    role: "fan" | "creator";
    avatar?: string;
  } | null>(null);
  const [selectedReason, setSelectedReason] = useState("");
  const [details, setDetails] = useState("");

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          router.push("/auth");
          return;
        }

        await ensureProfile();
        const profile = await getProfile(session.user.id);
        if (profile) {
          setCurrentUser({
            username: profile.display_name || "user",
            role: (profile.role || "fan") as "fan" | "creator",
            avatar: profile.avatar_url || undefined,
          });
        }
      } catch (err) {
        console.error("[report] loadData error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [router]);

  const handleSubmit = async () => {
    if (!selectedReason) {
      toast.error("Please select a report reason");
      return;
    }

    if (!id) {
      toast.error("Invalid report target");
      return;
    }

    setIsSubmitting(true);
    try {
      const reasonLabel =
        REPORT_REASONS.find((r) => r.id === selectedReason)?.label || selectedReason;
      const success = await submitReport({
        reported_type: type,
        reported_id: id,
        reason: reasonLabel,
        description: details.trim() || undefined,
      });

      if (success) {
        setSubmitted(true);
      } else {
        toast.error("Submission failed. Please try again");
      }
    } catch (err) {
      console.error("[report] submit error:", err);
      toast.error("Submission failed. Please try again");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-brand-primary animate-spin" />
      </div>
    );
  }

  // Success State
  if (submitted) {
    return (
      <div className="min-h-screen bg-background">
        {currentUser && <NavHeader user={currentUser} notificationCount={0} />}

        <div className="min-h-[calc(100vh-80px)] flex items-center justify-center px-4">
          <div className="max-w-md w-full text-center animate-in fade-in zoom-in duration-300">
            <div className="w-24 h-24 bg-semantic-success/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-12 h-12 text-semantic-success" />
            </div>

            <h1 className="text-3xl font-bold mb-3">Report submitted</h1>
            <p className="text-text-secondary text-lg mb-8">
              Thank you for helping keep GetFanSee safe. We&apos;ll review your report and take
              appropriate action.
            </p>

            <div className="bg-surface-base border border-border-base rounded-2xl p-6 text-left mb-8">
              <h3 className="font-semibold mb-3">What happens next?</h3>
              <ul className="space-y-2 text-sm text-text-secondary">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-[18px] h-[18px] text-semantic-success flex-shrink-0 mt-0.5" />
                  <span>Our moderation team will review the report</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-[18px] h-[18px] text-semantic-success flex-shrink-0 mt-0.5" />
                  <span>We&apos;ll take action if the content violates our policies</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-[18px] h-[18px] text-semantic-success flex-shrink-0 mt-0.5" />
                  <span>You&apos;ll be notified of the outcome via email</span>
                </li>
              </ul>
            </div>

            <Button
              onClick={() => router.push("/home")}
              className="w-full py-4 bg-brand-primary text-white rounded-xl font-semibold hover:bg-brand-primary/90 transition-all shadow-lg shadow-brand-primary/20"
            >
              Back to Feed
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {currentUser && <NavHeader user={currentUser} notificationCount={0} />}

      <main className="max-w-2xl mx-auto py-12 px-4">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-text-tertiary hover:text-brand-primary transition-colors mb-6"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>

          <h1 className="text-3xl md:text-4xl font-bold mb-2">Report {type}</h1>
          <p className="text-text-secondary text-lg">Help us understand what&apos;s wrong</p>
        </div>

        {/* Report Form */}
        <div className="bg-surface-base border border-border-base rounded-2xl p-6 mb-6">
          <h3 className="font-semibold text-lg mb-4">Why are you reporting this?</h3>

          <div className="space-y-3">
            {REPORT_REASONS.map((reason) => {
              const Icon = reason.icon;
              return (
                <label
                  key={reason.id}
                  className={`flex items-center gap-4 p-4 border-2 rounded-xl cursor-pointer transition-all ${
                    selectedReason === reason.id
                      ? "border-brand-primary bg-brand-primary/5"
                      : "border-border-base hover:border-brand-primary/30 hover:bg-surface-raised"
                  }`}
                >
                  <input
                    type="radio"
                    name="reason"
                    value={reason.id}
                    checked={selectedReason === reason.id}
                    onChange={(e) => setSelectedReason(e.target.value)}
                    className="sr-only"
                  />
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      selectedReason === reason.id ? "bg-brand-primary/10" : "bg-surface-raised"
                    }`}
                  >
                    <Icon
                      className={`w-[22px] h-[22px] ${
                        selectedReason === reason.id ? "text-brand-primary" : "text-text-tertiary"
                      }`}
                    />
                  </div>
                  <span className="font-semibold">{reason.label}</span>
                  {selectedReason === reason.id && (
                    <CheckCircle className="w-5 h-5 text-brand-primary ml-auto" />
                  )}
                </label>
              );
            })}
          </div>
        </div>

        {/* Additional Details */}
        <div className="bg-surface-base border border-border-base rounded-2xl p-6 mb-6">
          <label className="block mb-3 font-semibold text-lg">Additional details (optional)</label>
          <Textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Provide any additional information that might help us review this report..."
            rows={5}
            maxLength={500}
            className="w-full px-4 py-3 bg-surface-raised border border-border-base rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all resize-none"
          />
          <div className="flex justify-between mt-2 text-sm text-text-tertiary">
            <span>Help us understand the issue better</span>
            <span>{details.length}/500</span>
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-brand-primary/5 border border-brand-primary/20 rounded-xl p-4 mb-6 flex items-start gap-3">
          <Shield className="w-5 h-5 text-brand-primary flex-shrink-0 mt-0.5" />
          <div className="text-sm text-text-secondary">
            <p className="font-medium text-text-primary mb-1">Your report is anonymous</p>
            <p>The person you&apos;re reporting won&apos;t know you submitted this report.</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            onClick={() => router.back()}
            variant="outline"
            className="flex-1 py-4 bg-surface-base border border-border-base rounded-xl font-semibold hover:bg-surface-raised transition-all"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedReason || isSubmitting}
            className="flex-1 py-4 bg-semantic-error text-white rounded-xl font-semibold hover:bg-semantic-error/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg"
          >
            {isSubmitting ? "Submitting..." : "Submit Report"}
          </Button>
        </div>
      </main>
    </div>
  );
}
