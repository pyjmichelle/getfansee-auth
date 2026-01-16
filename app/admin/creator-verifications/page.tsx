"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { NavHeader } from "@/components/nav-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { ensureProfile } from "@/lib/auth";
import { getProfile } from "@/lib/profile";
import { listPendingVerifications, reviewVerification } from "@/lib/kyc";
import { Check, X, Calendar, Globe, FileText } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
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
          setCurrentUser({
            username: profile.display_name || "user",
            role: (profile.role || "fan") as "fan" | "creator",
            avatar: profile.avatar_url || undefined,
          });

          // TODO: 检查是否为管理员（这里简化处理，实际应该检查 admin 角色）
          // 暂时允许所有用户访问，实际应该添加权限检查
        }

        // 加载待审核列表
        const pending = await listPendingVerifications();
        setVerifications(pending);
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

      const success = await reviewVerification(
        verificationId,
        approve,
        approve ? undefined : rejectionReason.trim() || undefined
      );

      if (success) {
        toast.success(approve ? "验证已通过" : "验证已拒绝");
        // 重新加载列表
        const pending = await listPendingVerifications();
        setVerifications(pending);
        setReviewingId(null);
        setRejectionReason("");
      } else {
        toast.error("操作失败，请重试");
      }
    } catch (err) {
      console.error("[admin-verifications] review error:", err);
      toast.error("操作失败，请重试");
    } finally {
      setIsReviewing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        {currentUser && <NavHeader user={currentUser} notificationCount={0} />}
        <main className="container max-w-6xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 bg-muted rounded-3xl"></div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {currentUser && <NavHeader user={currentUser} notificationCount={0} />}

      <main className="container max-w-6xl mx-auto px-4 md:px-8 py-8 md:py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Creator Verifications</h1>
          <p className="text-muted-foreground">Review and approve creator identity verifications</p>
        </div>

        {verifications.length === 0 ? (
          <div className="bg-card border border-border rounded-3xl p-12 text-center">
            <p className="text-muted-foreground">No pending verifications</p>
          </div>
        ) : (
          <div className="space-y-6">
            {verifications.map((verification) => (
              <div
                key={verification.id}
                className="bg-card border border-border rounded-3xl p-6 hover:border-border transition-colors"
              >
                <div className="flex items-start gap-6">
                  <Avatar className="w-16 h-16">
                    <AvatarImage src={verification.user?.avatar_url || "/placeholder.svg"} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {verification.user?.display_name?.[0]?.toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-4">
                      <h3 className="text-lg font-semibold text-foreground">
                        {verification.user?.display_name ||
                          `User ${verification.user_id.slice(0, 8)}`}
                      </h3>
                      <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 rounded-lg">
                        Pending
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <FileText className="w-4 h-4" />
                        <span>Name: {verification.real_name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="w-4 h-4" />
                        <span>
                          Birth Date: {format(new Date(verification.birth_date), "MMM d, yyyy")}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Globe className="w-4 h-4" />
                        <span>Country: {verification.country}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="w-4 h-4" />
                        <span>
                          Submitted: {format(new Date(verification.created_at), "MMM d, yyyy")}
                        </span>
                      </div>
                    </div>

                    {/* ID Documents */}
                    <div className="mb-4">
                      <Label className="text-sm text-muted-foreground mb-2 block">
                        ID Documents:
                      </Label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {verification.id_doc_urls.map((url, index) => (
                          <a
                            key={index}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="relative aspect-video bg-muted rounded-xl overflow-hidden hover:opacity-80 transition-opacity"
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
                    <div className="flex gap-3 pt-4 border-t border-border">
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
                        className="flex-1 border-destructive text-destructive hover:bg-destructive/10 rounded-xl"
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
          <AlertDialogContent className="bg-card border-border rounded-3xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-foreground">Reject Verification</AlertDialogTitle>
              <AlertDialogDescription className="text-muted-foreground">
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
                  placeholder="例如：证件照片不清晰，信息不匹配等"
                  className="bg-card border-border rounded-xl"
                  rows={4}
                />
              </div>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel className="border-border bg-card hover:bg-card rounded-xl">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => reviewingId && handleReview(reviewingId, false)}
                className="bg-destructive hover:bg-destructive/90 rounded-xl"
              >
                Reject
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
}
