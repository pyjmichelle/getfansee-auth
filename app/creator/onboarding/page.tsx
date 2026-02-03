"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { NavHeader } from "@/components/nav-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Upload } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
// 所有服务器端函数都通过 API 调用，不直接导入
import { submitVerification } from "@/lib/kyc";
import { toast } from "sonner";
import { LoadingState } from "@/components/loading-state";

const supabase = getSupabaseBrowserClient();

export default function CreatorOnboardingPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<{
    role: string;
    display_name?: string;
    bio?: string;
    avatar_url?: string;
  } | null>(null);

  const [formData, setFormData] = useState({
    display_name: "",
    bio: "",
    avatar_url: "",
  });
  const [kycData, setKycData] = useState({
    real_name: "",
    birth_date: "",
    country: "",
    id_doc_files: [] as File[],
  });
  const [currentStep, setCurrentStep] = useState<"profile" | "kyc">("profile");
  const [isSubmittingKYC, setIsSubmittingKYC] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<{
    status: string;
    reviewed_at: string | null;
    rejection_reason: string | null;
  } | null>(null);

  // 加载用户信息和 profile
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !session) {
          router.push("/auth");
          return;
        }

        // 确保 profile 存在（通过 API）
        await fetch("/api/auth/ensure-profile", { method: "POST" });
        setCurrentUserId(session.user.id);

        // 加载 profile（通过 API）
        const profileResponse = await fetch("/api/profile");
        if (profileResponse.ok) {
          const profileData = (await profileResponse.json()).profile;
          if (profileData) {
            setProfile(profileData);
            setFormData({
              display_name: profileData.display_name || "",
              bio: profileData.bio || "",
              avatar_url: profileData.avatar_url || "",
            });

            // 检查是否已有验证记录（通过 API）
            const verificationResponse = await fetch("/api/kyc/verification");
            if (verificationResponse.ok) {
              const verificationData = await verificationResponse.json();
              const verification = verificationData.verification;
              if (verification) {
                setVerificationStatus(verification);
                if (verification.status === "pending") {
                  setCurrentStep("kyc");
                }
              }
            }
          }
        }
      } catch (err) {
        console.error("[onboarding] loadProfile error", err);
        setError("Failed to load profile");
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentUserId) {
      setError("User not logged in");
      return;
    }

    if (!formData.display_name.trim()) {
      setError("Display name is required");
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      // 通过 API 更新 profile
      const updateResponse = await fetch("/api/profile/update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: formData.display_name.trim(),
          bio: formData.bio.trim() || undefined,
          avatar_url: formData.avatar_url.trim() || undefined,
        }),
      });

      if (!updateResponse.ok) {
        setError("Update failed. Please try again");
        return;
      }

      const updateData = await updateResponse.json();
      if (updateData.success) {
        toast.success("Profile updated successfully");
        // 重新加载 profile 以获取最新数据（包括 age_verified）
        const profileResponse = await fetch("/api/profile");
        if (profileResponse.ok) {
          const profileData = (await profileResponse.json()).profile;
          if (profileData) {
            setProfile(profileData);
            // 如果用户还未完成 KYC，进入 KYC 步骤
            interface ProfileData {
              age_verified?: boolean;
              [key: string]: unknown;
            }
            if (!(profileData as ProfileData).age_verified) {
              setCurrentStep("kyc");
            } else {
              setTimeout(() => {
                router.push("/home");
              }, 500);
            }
          } else {
            setCurrentStep("kyc");
          }
        } else {
          setCurrentStep("kyc");
        }
      } else {
        setError("Update failed. Please try again");
      }
    } catch (err) {
      console.error("[onboarding] handleSubmit error", err);
      setError("Update failed. Please try again");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingState type="spinner" text="Loading profile..." />
      </div>
    );
  }

  const currentUser = {
    username: profile?.display_name || "user",
    role: (profile?.role || "fan") as "fan" | "creator",
    avatar: profile?.avatar_url || "/placeholder.svg",
  };

  return (
    <div className="min-h-screen bg-background">
      <NavHeader user={currentUser} notificationCount={0} />

      <main className="container max-w-2xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">Become a Creator</h1>
          <p className="text-muted-foreground">
            Set up your profile and start monetizing your content
          </p>
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-3xl p-4 mb-6">
            <p className="text-destructive font-medium">Error</p>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
          </div>
        )}

        <Card className="p-6">
          {currentStep === "profile" ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Avatar */}
              <div className="flex flex-col items-center mb-6">
                <Avatar className="w-24 h-24 mb-4">
                  <AvatarImage src={formData.avatar_url || "/placeholder.svg"} />
                  <AvatarFallback className="text-2xl">
                    {formData.display_name[0]?.toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <Label htmlFor="avatar_url" className="text-sm text-muted-foreground">
                  Avatar URL (Optional)
                </Label>
                <Input
                  id="avatar_url"
                  type="url"
                  placeholder="https://example.com/avatar.jpg"
                  value={formData.avatar_url}
                  onChange={(e) => setFormData({ ...formData, avatar_url: e.target.value })}
                  className="mt-2 max-w-md bg-card border-border rounded-xl"
                />
              </div>

              {/* Display Name */}
              <div className="space-y-2">
                <Label htmlFor="display_name">
                  Display Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="display_name"
                  type="text"
                  placeholder="Your display name"
                  value={formData.display_name}
                  onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                  required
                  disabled={isSaving}
                  className="bg-card border-border rounded-xl"
                />
              </div>

              {/* Bio */}
              <div className="space-y-2">
                <Label htmlFor="bio">Bio (Optional)</Label>
                <Textarea
                  id="bio"
                  placeholder="Tell us about yourself..."
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  rows={4}
                  disabled={isSaving}
                  className="bg-card border-border rounded-xl"
                />
              </div>

              {/* Submit Button */}
              <div className="flex gap-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/home")}
                  disabled={isSaving}
                  className="flex-1 border-border bg-card hover:bg-card rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSaving}
                  variant="gradient"
                  className="flex-1 rounded-xl"
                >
                  {isSaving ? "Saving…" : "Next"}
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              {verificationStatus?.status === "pending" && (
                <div className="bg-[var(--bg-purple-500-10)] border border-[var(--border-purple-500-20)] rounded-xl p-4">
                  <p className="text-sm text-[var(--color-purple-400)]">
                    Your verification request is under review. Please wait patiently.
                  </p>
                </div>
              )}

              {verificationStatus?.status === "rejected" && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4">
                  <p className="text-sm text-destructive font-medium mb-2">Verification Rejected</p>
                  {verificationStatus.rejection_reason && (
                    <p className="text-sm text-muted-foreground">
                      Reason: {verificationStatus.rejection_reason}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground mt-2">
                    You can resubmit your application.
                  </p>
                </div>
              )}

              {verificationStatus?.status === "approved" && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
                  <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                    Verification Approved
                  </p>
                  <Button
                    onClick={() => router.push("/home")}
                    variant="gradient"
                    className="mt-4 rounded-xl"
                  >
                    Complete
                  </Button>
                </div>
              )}

              {(!verificationStatus || verificationStatus.status === "rejected") && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!currentUserId) return;

                    if (!kycData.real_name.trim() || !kycData.birth_date || !kycData.country) {
                      toast.error("Please fill in all required fields");
                      return;
                    }

                    if (kycData.id_doc_files.length === 0) {
                      toast.error("Please upload at least one ID document photo");
                      return;
                    }

                    setIsSubmittingKYC(true);
                    try {
                      const success = await submitVerification(currentUserId, {
                        real_name: kycData.real_name.trim(),
                        birth_date: kycData.birth_date,
                        country: kycData.country,
                        id_doc_files: kycData.id_doc_files,
                      });

                      if (success) {
                        toast.success("Verification request submitted. Awaiting review");
                        // 通过 API 获取验证状态
                        const verificationResponse = await fetch("/api/kyc/verification");
                        if (verificationResponse.ok) {
                          const verificationData = await verificationResponse.json();
                          const verification = verificationData.verification;
                          if (verification) {
                            setVerificationStatus(verification);
                          }
                        }
                      } else {
                        toast.error("Submission failed. Please try again");
                      }
                    } catch (err: unknown) {
                      console.error("[onboarding] submit KYC error:", err);
                      const message =
                        err instanceof Error ? err.message : "Submission failed. Please try again";
                      toast.error(message);
                    } finally {
                      setIsSubmittingKYC(false);
                    }
                  }}
                  className="space-y-6"
                >
                  <div className="space-y-2">
                    <Label htmlFor="real_name">
                      Legal Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="real_name"
                      type="text"
                      value={kycData.real_name}
                      onChange={(e) => setKycData({ ...kycData, real_name: e.target.value })}
                      required
                      disabled={isSubmittingKYC}
                      className="bg-card border-border rounded-xl"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="birth_date">
                      Date of Birth <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="birth_date"
                      type="date"
                      value={kycData.birth_date}
                      onChange={(e) => setKycData({ ...kycData, birth_date: e.target.value })}
                      required
                      disabled={isSubmittingKYC}
                      className="bg-card border-border rounded-xl"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="country">
                      Country <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="country"
                      type="text"
                      value={kycData.country}
                      onChange={(e) => setKycData({ ...kycData, country: e.target.value })}
                      placeholder="e.g., US, CN, JP"
                      required
                      disabled={isSubmittingKYC}
                      className="bg-card border-border rounded-xl"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>
                      ID Document Photos <span className="text-destructive">*</span>
                    </Label>
                    <div className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-border transition-colors">
                      <input
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,image/webp"
                        multiple
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          setKycData({ ...kycData, id_doc_files: files });
                        }}
                        disabled={isSubmittingKYC}
                        className="hidden"
                        id="id_doc_upload"
                      />
                      <label
                        htmlFor="id_doc_upload"
                        className="cursor-pointer flex flex-col items-center gap-2"
                      >
                        <Upload className="w-8 h-8 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {kycData.id_doc_files.length > 0
                            ? `${kycData.id_doc_files.length} file${kycData.id_doc_files.length > 1 ? "s" : ""} selected`
                            : "Click to upload ID document photos (multiple files supported)"}
                        </span>
                      </label>
                    </div>
                    {kycData.id_doc_files.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {kycData.id_doc_files.map((file, index) => (
                          <div
                            key={index}
                            className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded"
                          >
                            {file.name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-4 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setCurrentStep("profile")}
                      disabled={isSubmittingKYC}
                      className="flex-1 border-border bg-card hover:bg-card rounded-xl"
                    >
                      Previous
                    </Button>
                    <Button
                      type="submit"
                      disabled={isSubmittingKYC}
                      variant="gradient"
                      className="flex-1 rounded-xl"
                    >
                      {isSubmittingKYC ? "Submitting…" : "Submit Verification"}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
