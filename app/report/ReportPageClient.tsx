"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { NavHeader } from "@/components/nav-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LoadingState } from "@/components/loading-state";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { ensureProfile } from "@/lib/auth";
import { getProfile } from "@/lib/profile";
import { submitReport, type ReportType } from "@/lib/reports";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft } from "lucide-react";

const supabase = getSupabaseBrowserClient();

type ReportPageClientProps = {
  initialType: ReportType;
  initialId: string;
};

const REPORT_REASONS = [
  "Inappropriate content",
  "Spam or scam",
  "Harassment or bullying",
  "Copyright violation",
  "False information",
  "Other",
];

export default function ReportPageClient({ initialType, initialId }: ReportPageClientProps) {
  const router = useRouter();
  const type = initialType;
  const id = initialId;

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState<{
    username: string;
    role: "fan" | "creator";
    avatar?: string;
  } | null>(null);
  const [formData, setFormData] = useState({
    reason: "",
    description: "",
  });

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.reason) {
      toast.error("Please select a report reason");
      return;
    }

    if (!id) {
      toast.error("Invalid report target");
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await submitReport({
        reported_type: type,
        reported_id: id,
        reason: formData.reason,
        description: formData.description.trim() || undefined,
      });

      if (success) {
        toast.success("Report submitted. We will review it shortly");
        setTimeout(() => {
          router.back();
        }, 1500);
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
        <LoadingState type="spinner" text="Loading..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {currentUser && <NavHeader user={currentUser} notificationCount={0} />}

      <main className="container max-w-2xl mx-auto px-4 md:px-8 py-8 md:py-12">
        <Button
          variant="ghost"
          size="sm"
          className="mb-6 border-border bg-card hover:bg-card rounded-xl"
          onClick={() => router.back()}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Report Content</h1>
          <p className="text-muted-foreground">Help us keep the community safe</p>
        </div>

        <Card className="bg-card border border-border rounded-3xl p-6 md:p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex items-start gap-3 p-4 bg-[var(--bg-purple-500-10)] border border-[var(--border-purple-500-20)] rounded-xl">
              <AlertTriangle className="w-5 h-5 text-[var(--color-purple-400)] flex-shrink-0 mt-0.5" />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">Reporting {type}</p>
                <p>
                  Please provide accurate information. False reports may result in account
                  restrictions.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">
                Reason <span className="text-destructive">*</span>
              </Label>
              <select
                id="reason"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                required
                className="w-full h-11 px-3 bg-card border border-border rounded-xl text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <option value="">Select a reason</option>
                {REPORT_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Additional Details (Optional)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Please provide any additional information that might help us understand the issue..."
                rows={6}
                className="bg-card border-border rounded-xl"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={isSubmitting}
                className="flex-1 border-border bg-card hover:bg-card rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                variant="gradient"
                className="flex-1 rounded-xl"
              >
                {isSubmitting ? "Submitting..." : "Submit Report"}
              </Button>
            </div>
          </form>
        </Card>
      </main>
    </div>
  );
}
