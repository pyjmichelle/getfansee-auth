"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { ensureProfile } from "@/lib/auth";
import { getProfile } from "@/lib/profile";
import { Check, X, Calendar, Globe, FileText } from "@/lib/icons";
import { format } from "date-fns";
import { toast } from "sonner";
import { Analytics } from "@/lib/analytics";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { DEFAULT_AVATAR_FAN } from "@/lib/image-fallbacks";

const supabase = getSupabaseBrowserClient();

interface Verification {
  id: string;
  user_id: string;
  real_name: string;
  birth_date: string;
  country: string;
  id_doc_urls: string[];
  status: string;
  created_at: string;
  user?: {
    display_name?: string;
    avatar_url?: string;
  };
}

export default function CreatorVerificationsPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [currentUser, setCurrentUser] = useState<{
    username: string;
    role: "fan" | "creator";
    avatar?: string;
  } | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isReviewing, setIsReviewing] = useState(false);

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
          if (profile.role !== "admin") {
            router.push("/home");
            return;
          }
          setCurrentUser({
            username: profile.display_name || "user",
            role: (profile.role || "fan") as "fan" | "creator",
            avatar: profile.avatar_url || undefined,
          });
        }

        // 加载待审核列表（通过安全的 API Route）
        const res = await fetch("/api/admin/kyc");
        if (res.ok) {
          const data = await res.json();
          setVerifications(data.verifications || []);
        }
      } catch (err) {
        console.error("[admin-verifications] loadData error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [router]);

  const handleReview = async (verificationId: string, approve: boolean) => {
    try {
      setIsReviewing(true);

      const response = await fetch("/api/admin/kyc", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verificationId,
          approve,
          reason: approve ? undefined : rejectionReason.trim() || undefined,
        }),
      });

      const result = await response.json();

      if (result.success) {
        Analytics.adminKycReviewed(verificationId, approve ? "approved" : "rejected");
        toast.success(approve ? "Verification approved" : "Verification rejected");
        // 重新加载列表（通过安全的 API Route）
        const res = await fetch("/api/admin/kyc");
        if (res.ok) {
          const data = await res.json();
          setVerifications(data.verifications || []);
        }
        setReviewingId(null);
        setRejectionReason("");
      } else {
        toast.error("Action failed. Please try again");
      }
    } catch (err) {
      console.error("[admin-verifications] review error:", err);
      toast.error("Action failed. Please try again");
    } finally {
      setIsReviewing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4 max-w-4xl">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-surface-raised rounded-2xl"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-text-primary mb-2">Creator Verifications</h1>
          <p className="text-text-tertiary">Review and approve creator identity verifications</p>
        </div>
        <div className="bento-grid mb-6">
          <div className="bento-2x1 card-block p-5">
            <p className="text-sm text-text-tertiary">Pending</p>
            <p className="text-3xl font-bold text-brand-secondary">{verifications.length}</p>
          </div>
          <div className="card-block p-5">
            <p className="text-sm text-text-tertiary">Approved</p>
            <p className="text-3xl font-bold text-success">0</p>
          </div>
          <div className="card-block p-5">
            <p className="text-sm text-text-tertiary">Rejected</p>
            <p className="text-3xl font-bold text-error">0</p>
          </div>
        </div>

        {verifications.length === 0 ? (
          <div className="card-block p-12 text-center">
            <p className="text-text-tertiary">No pending verifications</p>
          </div>
        ) : (
          <div className="space-y-6">
            {verifications.map((verification) => (
              <div key={verification.id} className="card-block p-6">
                <div className="flex items-start gap-6">
                  <Avatar className="w-16 h-16">
                    <AvatarImage src={verification.user?.avatar_url || DEFAULT_AVATAR_FAN} />
                    <AvatarFallback className="bg-brand-primary-alpha-10 text-brand-primary">
                      {verification.user?.display_name?.[0]?.toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-4">
                      <h3 className="text-lg font-semibold text-text-primary">
                        {verification.user?.display_name ||
                          `User ${verification.user_id.slice(0, 8)}`}
                      </h3>
                      <Badge className="bg-brand-secondary/10 text-brand-secondary border-brand-secondary/20 rounded-lg">
                        Pending
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="flex items-center gap-2 text-sm text-text-tertiary">
                        <FileText className="w-4 h-4" />
                        <span>Name: {verification.real_name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-text-tertiary">
                        <Calendar className="w-4 h-4" />
                        <span>
                          Birth Date: {format(new Date(verification.birth_date), "MMM d, yyyy")}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-text-tertiary">
                        <Globe className="w-4 h-4" />
                        <span>Country: {verification.country}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-text-tertiary">
                        <Calendar className="w-4 h-4" />
                        <span>
                          Submitted: {format(new Date(verification.created_at), "MMM d, yyyy")}
                        </span>
                      </div>
                    </div>

                    {/* ID Documents */}
                    <div className="mb-4">
                      <Label className="text-sm text-text-tertiary mb-2 block">ID Documents:</Label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {verification.id_doc_urls.map((url, index) => (
                          <a
                            key={index}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="relative aspect-video bg-surface-raised rounded-xl overflow-hidden hover:opacity-80 transition-opacity"
                          >
                            <img
                              src={url}
                              alt={`ID Document ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                          </a>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-4 border-t border-border-base">
                      <Button
                        onClick={() => handleReview(verification.id, true)}
                        disabled={isReviewing}
                        variant="gradient"
                        className="flex-1 rounded-xl"
                      >
                        <Check className="w-4 h-4 mr-2" />
                        Approve
                      </Button>
                      <Button
                        onClick={() => setReviewingId(verification.id)}
                        disabled={isReviewing}
                        variant="outline"
                        className="flex-1 border-error text-error hover:bg-error/10 rounded-xl"
                      >
                        <X className="w-4 h-4 mr-2" />
                        Reject
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Rejection Dialog */}
        <AlertDialog
          open={reviewingId !== null}
          onOpenChange={(open) => !open && setReviewingId(null)}
        >
          <AlertDialogContent className="bg-surface-base border-border-base rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-text-primary">Reject Verification</AlertDialogTitle>
              <AlertDialogDescription className="text-text-tertiary">
                Please provide a reason for rejection (optional but recommended).
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="rejection_reason">Rejection Reason</Label>
                <Textarea
                  id="rejection_reason"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g., ID photos are unclear, information doesn't match, etc."
                  className="bg-surface-base border-border-base rounded-xl"
                  rows={4}
                />
              </div>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel className="border-border-base bg-surface-base hover:bg-surface-raised rounded-xl">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => reviewingId && handleReview(reviewingId, false)}
                className="bg-error hover:bg-error/90 rounded-xl"
              >
                Reject
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
