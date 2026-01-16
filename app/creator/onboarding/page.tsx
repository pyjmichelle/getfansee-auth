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
import { Camera, Upload } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
// 所有服务器端函数都通过 API 调用，不直接导入
import { submitVerification, type VerificationData } from "@/lib/kyc";
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
        setError("加载 profile 失败");
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentUserId) {
      setError("用户未登录");
      return;
    }

    if (!formData.display_name.trim()) {
      setError("Display name 是必填项");
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
        setError("更新失败，请重试");
        return;
      }

      const updateData = await updateResponse.json();
      if (updateData.success) {
        toast.success("Profile 更新成功！");
        // 重新加载 profile 以获取最新数据（包括 age_verified）
        const profileResponse = await fetch("/api/profile");
        if (profileResponse.ok) {
          const profileData = (await profileResponse.json()).profile;
          if (profileData) {
            setProfile(profileData);
            // 如果用户还未完成 KYC，进入 KYC 步骤
            if (!(profileData as any).age_verified) {
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
        setError("更新失败，请重试");
      }
    } catch (err) {
      console.error("[onboarding] handleSubmit error", err);
      setError("更新失败，请重试");
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
          <h1 className="text-3xl font-bold text-foreground mb-2">Creator Onboarding</h1>
          <p className="text-muted-foreground">完善你的 creator profile 信息</p>
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-3xl p-4 mb-6">
            <p className="text-destructive font-medium">错误</p>
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
                  Avatar URL (可选)
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
                <Label htmlFor="bio">Bio (可选)</Label>
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
                  取消
                </Button>
                <Button
                  type="submit"
                  disabled={isSaving}
                  variant="gradient"
                  className="flex-1 rounded-xl"
                >
                  {isSaving ? "保存中..." : "下一步"}
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              {verificationStatus?.status === "pending" && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                  <p className="text-sm text-amber-500">您的身份验证申请正在审核中，请耐心等待。</p>
                </div>
              )}

              {verificationStatus?.status === "rejected" && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4">
                  <p className="text-sm text-destructive font-medium mb-2">验证被拒绝</p>
                  {verificationStatus.rejection_reason && (
                    <p className="text-sm text-muted-foreground">
                      原因：{verificationStatus.rejection_reason}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground mt-2">您可以重新提交申请。</p>
                </div>
              )}

              {verificationStatus?.status === "approved" && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
                  <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                    身份验证已通过
                  </p>
                  <Button
                    onClick={() => router.push("/home")}
                    variant="gradient"
                    className="mt-4 rounded-xl"
                  >
                    完成
                  </Button>
                </div>
              )}

              {(!verificationStatus || verificationStatus.status === "rejected") && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!currentUserId) return;

                    if (!kycData.real_name.trim() || !kycData.birth_date || !kycData.country) {
                      toast.error("请填写所有必填字段");
                      return;
                    }

                    if (kycData.id_doc_files.length === 0) {
                      toast.error("请上传至少一张证件照片");
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
                        toast.success("身份验证申请已提交，等待审核");
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
                        toast.error("提交失败，请重试");
                      }
                    } catch (err: any) {
                      console.error("[onboarding] submit KYC error:", err);
                      toast.error(err.message || "提交失败，请重试");
                    } finally {
                      setIsSubmittingKYC(false);
                    }
                  }}
                  className="space-y-6"
                >
                  <div className="space-y-2">
                    <Label htmlFor="real_name">
                      真实姓名 <span className="text-destructive">*</span>
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
                      出生日期 <span className="text-destructive">*</span>
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
                      国家 <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="country"
                      type="text"
                      value={kycData.country}
                      onChange={(e) => setKycData({ ...kycData, country: e.target.value })}
                      placeholder="例如：US, CN, JP"
                      required
                      disabled={isSubmittingKYC}
                      className="bg-card border-border rounded-xl"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>
                      证件照片 <span className="text-destructive">*</span>
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
                            ? `已选择 ${kycData.id_doc_files.length} 个文件`
                            : "点击上传证件照片（支持多张）"}
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
                      上一步
                    </Button>
                    <Button
                      type="submit"
                      disabled={isSubmittingKYC}
                      variant="gradient"
                      className="flex-1 rounded-xl"
                    >
                      {isSubmittingKYC ? "提交中..." : "提交验证"}
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
