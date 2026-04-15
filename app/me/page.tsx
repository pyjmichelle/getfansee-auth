"use client";

import { useState, useEffect } from "react";
import { Camera, LogOut, Loader2 } from "@/lib/icons";
import { PageShell } from "@/components/page-shell";
// Card components no longer needed - using Figma div-based layout
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TabsContent } from "@/components/ui/tabs";
// CenteredContainer no longer needed - using Figma max-w layout
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { signOut } from "@/lib/auth";
import { uploadAvatar } from "@/lib/storage";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useCountUp } from "@/hooks/use-count-up";
import { DEFAULT_AVATAR_FAN } from "@/lib/image-fallbacks";
import { ProfileBanner } from "@/components/profile-banner";
import { SettingsTabs } from "@/components/settings-tabs";
import { GlassCard } from "@/components/glass-card";
import { getAuthBootstrap } from "@/lib/auth-bootstrap-client";
import { useSkeletonMetric } from "@/hooks/use-skeleton-metric";

const supabase = getSupabaseBrowserClient();

export default function ProfilePage() {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingCreator, setIsCreatingCreator] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState("");
  const [currentUser, setCurrentUser] = useState<{
    username: string;
    role: "fan" | "creator";
    avatar?: string;
  } | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [activeTab, setActiveTab] = useState("profile");
  useSkeletonMetric("me_page", isLoading);
  const creatorSocialCount = useCountUp(currentUser?.role === "creator" ? 1284 : 1283, {
    duration: 900,
    decimals: 0,
  });

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const bootstrap = await getAuthBootstrap();
        if (!bootstrap.authenticated || !bootstrap.user) {
          router.push("/auth");
          return;
        }

        setCurrentUserId(bootstrap.user.id);
        setEmail(bootstrap.user.email || "");

        // 加载 profile（通过 API）
        const profileResponse = await fetch("/api/profile");
        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          const profile = profileData.profile;
          if (profile) {
            setUsername(profile.display_name || "");
            setBio(profile.bio || "");
            setAvatar(profile.avatar_url || "");
            setCurrentUser({
              username: profile.display_name || "user",
              role: (profile.role || "fan") as "fan" | "creator",
              avatar: profile.avatar_url || undefined,
            });
          }
        }
      } catch (err) {
        console.error("[me] loadProfile error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, [router]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUserId) return;

    setIsUploadingAvatar(true);
    try {
      const avatarUrl = await uploadAvatar(file, currentUserId);
      setAvatar(avatarUrl);

      // Auto-save immediately so the change persists without requiring "Save Changes"
      await fetch("/api/profile/general", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar_url: avatarUrl }),
      });

      toast.success("Avatar updated successfully");
    } catch (err: unknown) {
      console.error("[me] avatar upload error:", err);
      const message = err instanceof Error ? err.message : "Failed to upload avatar";
      toast.error(message);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (!currentUserId) return;

    // 验证昵称唯一性（可选，这里简化处理）
    if (username.trim().length > 0 && username.trim().length < 2) {
      toast.error("Username must be at least 2 characters");
      return;
    }

    setIsSaving(true);
    try {
      // 通过 API 更新 profile
      const updateResponse = await fetch("/api/profile/general", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: username.trim() || null,
          bio: bio.trim() || null,
          avatar_url: avatar || null,
        }),
      });

      if (!updateResponse.ok) {
        toast.error("Failed to save, please try again");
        return;
      }

      const updateData = await updateResponse.json();
      if (!updateData.success) {
        toast.error("Failed to save, please try again");
        return;
      }

      setIsEditing(false);
      if (currentUser) {
        setCurrentUser({
          ...currentUser,
          username: username.trim() || currentUser.username,
          avatar: avatar || currentUser.avatar,
        });
      }
      toast.success("Profile updated successfully");
    } catch (err) {
      console.error("[me] handleSave error:", err);
      alert("Failed to save, please try again");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateCreator = async () => {
    if (!currentUserId || isCreatingCreator) return;

    setIsCreatingCreator(true);
    try {
      // 通过 API 创建 creator
      const createResponse = await fetch("/api/creator/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: username || email.split("@")[0],
          bio: bio || null,
          avatar_url: avatar || null,
        }),
      });

      if (!createResponse.ok) {
        const errorData = await createResponse.json().catch(() => null);
        if (errorData?.error === "KYC_REQUIRED") {
          toast.info("Identity verification required before becoming a creator");
          router.push("/creator/upgrade/kyc");
          return;
        }
        toast.error("Failed to create creator profile, please try again");
        return;
      }

      if (currentUser) {
        setCurrentUser({ ...currentUser, role: "creator" });
      }
      toast.success("Creator profile created successfully!");
    } catch (err) {
      console.error("[me] handleCreateCreator error:", err);
      alert("Failed to create, please try again");
    } finally {
      setIsCreatingCreator(false);
    }
  };

  const handleSeedPosts = async () => {
    if (!currentUserId || isSeeding) return;

    setIsSeeding(true);
    try {
      // 检查是否为 creator（通过 API）
      const profileResponse = await fetch("/api/profile");
      if (!profileResponse.ok) {
        alert("Please create a creator profile first");
        return;
      }
      const profileData = await profileResponse.json();
      const profile = profileData.profile;
      if (!profile || profile.role !== "creator") {
        alert("Please create a creator profile first");
        return;
      }

      const posts = [
        {
          creator_id: currentUserId,
          title: "Subscriber-Only Content",
          content: "This is exclusive content for subscribers only. Subscribe to unlock!",
          price_cents: 0, // subscriber-only
          cover_url: null,
        },
        {
          creator_id: currentUserId,
          title: "Premium PPV Content - $4.99",
          content: "This is a premium pay-per-view post. Unlock it for $4.99!",
          price_cents: 499, // PPV $4.99
          cover_url: null,
        },
        {
          creator_id: currentUserId,
          title: "Exclusive PPV Content - $9.99",
          content: "This is an exclusive premium post. Unlock it for $9.99!",
          price_cents: 999, // PPV $9.99
          cover_url: null,
        },
      ];

      const { error } = await supabase.from("posts").insert(posts);

      if (error) {
        console.error("[me] seed posts error:", error);
        alert("Failed to create demo posts, please try again");
        return;
      }

      alert("Demo posts created successfully!");
    } catch (err) {
      console.error("[me] handleSeedPosts error:", err);
      alert("Failed to create, please try again");
    } finally {
      setIsSeeding(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/session", { method: "DELETE" });
    await signOut();
    router.push("/auth");
  };

  if (isLoading || !currentUser) {
    return (
      <PageShell user={currentUser} notificationCount={0} maxWidth="3xl">
        <div className="pb-24 space-y-6">
          {/* Hero skeleton */}
          <div className="card-block bg-gradient-subtle p-6 md:p-8 animate-pulse">
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              <div className="flex items-center gap-5">
                <div className="w-24 h-24 rounded-full bg-white/8" />
                <div className="space-y-2">
                  <div className="h-8 w-36 bg-white/8 rounded" />
                  <div className="h-4 w-48 bg-white/8 rounded" />
                  <div className="h-6 w-20 bg-white/8 rounded-full" />
                </div>
              </div>
              <div className="h-10 w-32 bg-white/8 rounded-xl md:ml-auto hidden md:block" />
            </div>
          </div>
          {/* Cards skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="card-block p-6 md:p-8 h-48 animate-pulse bg-white/5" />
            <div className="card-block p-6 md:p-8 h-48 animate-pulse bg-white/5" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="card-block p-6 md:p-8 h-40 animate-pulse bg-white/5" />
            <div className="card-block p-6 md:p-8 h-40 animate-pulse bg-white/5" />
          </div>
        </div>
      </PageShell>
    );
  }

  const handlePasswordChange = async () => {
    if (!currentUserId) return;

    if (!oldPassword || !newPassword || !confirmPassword) {
      toast.error("Please fill in all password fields");
      return;
    }

    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("New password and confirmation do not match");
      return;
    }

    setIsSaving(true);
    try {
      // 通过 API 更新密码
      const updateResponse = await fetch("/api/profile/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          oldPassword,
          newPassword,
        }),
      });

      if (!updateResponse.ok) {
        const errorData = await updateResponse.json();
        toast.error(errorData.error || "Failed to change password, please check your old password");
        return;
      }

      const updateData = await updateResponse.json();
      if (updateData.success) {
        toast.success("Password changed successfully");
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        toast.error("Failed to change password, please check your old password");
      }
    } catch (err) {
      console.error("[me] handlePasswordChange error:", err);
      toast.error("Failed to change password, please try again");
    } finally {
      setIsSaving(false);
    }
  };

  const settingsTabs = [
    { value: "profile", label: "Profile" },
    { value: "account", label: "Account" },
    { value: "security", label: "Security" },
  ];

  return (
    <PageShell user={currentUser} notificationCount={0} maxWidth="5xl">
      <div className="pb-24" data-testid="me-page-ready">
        {/* Profile Banner */}
        <ProfileBanner
          name={username || "Profile"}
          email={email}
          role={currentUser.role}
          avatarUrl={avatar || DEFAULT_AVATAR_FAN}
          action={
            isEditing ? (
              <Button onClick={handleSave} disabled={isSaving} className="shadow-glow">
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            ) : (
              <Button onClick={() => setIsEditing(true)} className="shadow-glow">
                Edit Profile
              </Button>
            )
          }
        />

        {/* PC Two-column | Mobile Single-column */}
        <div className="mt-6 flex flex-col md:flex-row gap-6">
          {/* Left sidebar navigation — desktop only */}
          <aside className="hidden md:flex flex-col gap-1 w-52 shrink-0">
            {settingsTabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`w-full text-left px-4 py-2.5 rounded-[var(--radius-sm)] text-[13px] font-medium transition-all ${
                  activeTab === tab.value
                    ? "bg-violet-500/15 text-violet-400 border border-violet-500/20"
                    : "text-text-muted hover:text-white hover:bg-white/6"
                }`}
              >
                {tab.label}
              </button>
            ))}
            {/* Logout shortcut */}
            <div className="mt-4 pt-4 border-t border-white/6">
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2.5 rounded-[var(--radius-sm)] text-[13px] font-medium text-red-400 hover:bg-red-500/8 transition-all"
              >
                Log Out
              </button>
            </div>
          </aside>

          {/* Right content area */}
          <div className="flex-1 min-w-0 md:w-0 min-h-[540px]">
            <SettingsTabs value={activeTab} onValueChange={setActiveTab} items={settingsTabs}>
              <TabsContent value="profile" className="mt-4">
                <GlassCard className="p-6">
                  <div className="mb-6 flex items-center gap-5">
                    <div className="relative group">
                      <Avatar className="w-24 h-24">
                        <AvatarImage src={avatar || DEFAULT_AVATAR_FAN} alt="Profile picture" />
                        <AvatarFallback className="text-2xl bg-brand-primary-alpha-10 text-brand-primary">
                          {username[0]?.toUpperCase() || email[0]?.toUpperCase() || "U"}
                        </AvatarFallback>
                      </Avatar>
                      {isEditing ? (
                        <label className="absolute inset-0 cursor-pointer rounded-full bg-black/60 opacity-70 hover:opacity-90 transition-opacity flex items-center justify-center">
                          <Camera className="w-6 h-6 text-white" aria-hidden="true" />
                          <input
                            type="file"
                            accept="image/jpeg,image/jpg,image/png,image/webp"
                            onChange={handleAvatarUpload}
                            className="hidden"
                            disabled={isUploadingAvatar}
                            aria-label="Choose avatar file"
                          />
                        </label>
                      ) : null}
                      {isUploadingAvatar ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                          <Loader2 className="w-6 h-6 text-white animate-spin" aria-hidden="true" />
                        </div>
                      ) : null}
                    </div>
                    <div>
                      <p className="text-sm text-text-secondary">
                        Upload a new profile picture (recommended 400x400).
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label
                        htmlFor="username"
                        className="mb-2 block text-sm font-medium text-text-secondary"
                      >
                        Display Name
                      </Label>
                      <Input
                        id="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        disabled={!isEditing}
                        className="h-10 rounded-xl bg-white/8"
                        placeholder="Enter your display name"
                      />
                    </div>
                    <div>
                      <Label
                        htmlFor="bio"
                        className="mb-2 block text-sm font-medium text-text-secondary"
                      >
                        Bio
                      </Label>
                      <Textarea
                        id="bio"
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        disabled={!isEditing}
                        placeholder="Tell people a bit about yourself"
                        className="min-h-[96px] rounded-xl bg-white/8"
                        maxLength={200}
                      />
                      <p className="mt-1 text-xs text-text-tertiary">{bio.length}/200</p>
                    </div>
                  </div>
                </GlassCard>
              </TabsContent>

              <TabsContent value="account" className="mt-4">
                <GlassCard className="p-6 space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-text-primary">Email Address</p>
                      <p className="text-sm text-text-tertiary">{email}</p>
                    </div>
                    <Button variant="outline" size="sm" disabled>
                      Change
                    </Button>
                  </div>
                  <div className="flex items-center justify-between border-t border-border-subtle pt-4">
                    <div>
                      <p className="font-medium text-text-primary">Account Type</p>
                      <p className="text-sm text-text-tertiary capitalize">{currentUser.role}</p>
                    </div>
                    {currentUser.role === "fan" ? (
                      <Button
                        onClick={handleCreateCreator}
                        disabled={isCreatingCreator}
                        data-testid="become-creator-button"
                        size="sm"
                      >
                        {isCreatingCreator ? "Creating..." : "Become Creator"}
                      </Button>
                    ) : null}
                  </div>
                  <div className="rounded-xl border border-border-base bg-gradient-subtle p-4">
                    <p className="text-sm text-text-secondary">
                      Join{" "}
                      <span className="font-bold text-brand-primary">
                        {creatorSocialCount.toFixed(0)}
                      </span>{" "}
                      creators already earning on GetFanSee.
                    </p>
                    {currentUser.role === "creator" ? (
                      <Button
                        onClick={handleSeedPosts}
                        disabled={isSeeding}
                        variant="outline"
                        className="mt-3 w-full"
                      >
                        {isSeeding ? "Seeding…" : "Seed demo posts"}
                      </Button>
                    ) : null}
                  </div>
                </GlassCard>
              </TabsContent>

              <TabsContent value="security" className="mt-4">
                <GlassCard className="p-6 space-y-4">
                  <div>
                    <Label
                      htmlFor="oldPassword"
                      className="mb-2 block text-sm font-medium text-text-secondary"
                    >
                      Current Password
                    </Label>
                    <Input
                      id="oldPassword"
                      type="password"
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      className="h-10 rounded-xl bg-white/8"
                      placeholder="Enter current password"
                      autoComplete="current-password"
                    />
                  </div>
                  <div>
                    <Label
                      htmlFor="newPassword"
                      className="mb-2 block text-sm font-medium text-text-secondary"
                    >
                      New Password
                    </Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="h-10 rounded-xl bg-white/8"
                      placeholder="Enter new password (min 8 characters)"
                      autoComplete="new-password"
                    />
                  </div>
                  <div>
                    <Label
                      htmlFor="confirmPassword"
                      className="mb-2 block text-sm font-medium text-text-secondary"
                    >
                      Confirm New Password
                    </Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="h-10 rounded-xl bg-white/8"
                      placeholder="Confirm new password"
                      autoComplete="new-password"
                    />
                  </div>
                  <Button
                    onClick={handlePasswordChange}
                    disabled={isSaving || !oldPassword || !newPassword || !confirmPassword}
                    className="w-full"
                  >
                    {isSaving ? "Updating..." : "Update Password"}
                  </Button>
                </GlassCard>
              </TabsContent>
            </SettingsTabs>

            {/* Mobile logout — desktop uses sidebar */}
            <GlassCard className="border-error/30 p-6 mt-4 md:hidden">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-text-primary">Log Out</p>
                  <p className="text-sm text-text-tertiary">Sign out of your account</p>
                </div>
                <Button
                  variant="outline"
                  onClick={handleLogout}
                  aria-label="Log out of your account"
                >
                  <LogOut className="w-4 h-4 mr-2" aria-hidden="true" />
                  Log Out
                </Button>
              </div>
            </GlassCard>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
