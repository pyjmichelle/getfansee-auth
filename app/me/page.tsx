"use client";

import { useState, useEffect } from "react";
import { User, Mail, Camera, Save, LogOut, Sparkles, Loader2 } from "lucide-react";
import { NavHeader } from "@/components/nav-header";
// Card components no longer needed - using Figma div-based layout
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LoadingState } from "@/components/loading-state";
// CenteredContainer no longer needed - using Figma max-w layout
import { BottomNavigation } from "@/components/bottom-navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
// 所有服务器端函数都通过 API 调用，不直接导入
import { uploadAvatar } from "@/lib/storage";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

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

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          router.push("/auth");
          return;
        }

        // 确保 profile 存在（通过 API）
        await fetch("/api/auth/ensure-profile", { method: "POST" });
        setCurrentUserId(session.user.id);
        setEmail(session.user.email || "");

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
      toast.success("Avatar uploaded successfully");
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
        alert("Failed to create creator profile, please try again");
        return;
      }

      if (currentUser) {
        setCurrentUser({ ...currentUser, role: "creator" });
      }
      alert("Creator profile created successfully!");
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
    await supabase.auth.signOut();
    router.push("/auth");
  };

  if (isLoading || !currentUser) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <NavHeader user={currentUser!} notificationCount={0} />
        <div className="pt-20 md:pt-24 pb-12 max-w-3xl mx-auto px-4 md:px-6">
          <LoadingState type="spinner" text="Loading profile…" />
        </div>
        <BottomNavigation notificationCount={0} userRole={currentUser?.role} />
      </div>
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

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-0">
      <NavHeader user={currentUser!} notificationCount={0} />

      <div className="pt-20 md:pt-24 pb-12">
        <div className="max-w-3xl mx-auto px-4 md:px-6">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2 text-text-primary">Profile Settings</h1>
            <p className="text-text-secondary">
              Manage your profile information and account settings
            </p>
          </div>

          {/* Avatar Section - Figma Style */}
          <div className="bg-surface-base border border-border-base rounded-2xl p-6 md:p-8 mb-6">
            <h2 className="font-semibold text-lg mb-6 text-text-primary">Profile Picture</h2>
            <div className="flex items-center gap-6">
              <div className="relative group">
                <Avatar className="w-24 h-24">
                  <AvatarImage src={avatar || "/placeholder.svg"} alt="Profile picture" />
                  <AvatarFallback className="text-2xl bg-brand-primary-alpha-10 text-brand-primary">
                    {username[0]?.toUpperCase() || email[0]?.toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                {isEditing && (
                  <label className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer">
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
                )}
                {isUploadingAvatar && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                    <Loader2 className="w-6 h-6 text-white animate-spin" aria-hidden="true" />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <p className="text-text-secondary text-sm mb-3">
                  Upload a new profile picture. Recommended size: 400x400px
                </p>
                {isEditing && (
                  <div className="flex gap-3">
                    <label className="px-4 py-2 bg-brand-primary text-white rounded-xl font-medium hover:bg-brand-primary-subtle transition-all cursor-pointer text-sm">
                      Upload new
                      <input
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,image/webp"
                        onChange={handleAvatarUpload}
                        className="hidden"
                        disabled={isUploadingAvatar}
                      />
                    </label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAvatar("")}
                      className="px-4 py-2 bg-surface-raised border border-border-base rounded-xl font-medium hover:bg-surface-overlay transition-all text-text-secondary"
                    >
                      Remove
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Basic Info - Figma Style */}
          <div className="bg-surface-base border border-border-base rounded-2xl p-6 md:p-8 mb-6">
            <h2 className="font-semibold text-lg mb-6 text-text-primary">Basic Information</h2>
            <div className="space-y-5">
              <div>
                <Label
                  htmlFor="username"
                  className="block mb-2.5 text-sm font-medium text-text-secondary"
                >
                  Display Name
                </Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={!isEditing}
                  className="w-full px-4 py-3 bg-surface-raised border border-border-base rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all"
                  placeholder="Enter your display name"
                />
              </div>

              <div>
                <Label
                  htmlFor="bio"
                  className="block mb-2.5 text-sm font-medium text-text-secondary"
                >
                  Bio
                </Label>
                <Textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  disabled={!isEditing}
                  placeholder="Tell people a bit about yourself"
                  className="w-full px-4 py-3 bg-surface-raised border border-border-base rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all resize-none min-h-[100px]"
                  maxLength={200}
                />
                <div className="flex justify-between mt-2">
                  <p className="text-sm text-text-tertiary">Tell people a bit about yourself</p>
                  <p className="text-sm text-text-tertiary">{bio.length}/200</p>
                </div>
              </div>
            </div>
          </div>

          {/* Account Info - Figma Style */}
          <div className="bg-surface-base border border-border-base rounded-2xl p-6 md:p-8 mb-6">
            <h2 className="font-semibold text-lg mb-6 text-text-primary">Account</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3">
                <div>
                  <div className="font-medium mb-1 text-text-primary">Email Address</div>
                  <div className="text-text-tertiary text-sm">{email}</div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled
                  className="px-4 py-2 bg-surface-raised border border-border-base rounded-xl font-medium hover:bg-surface-overlay transition-all text-sm"
                >
                  Change
                </Button>
              </div>

              <div className="flex items-center justify-between py-3 border-t border-border-subtle">
                <div>
                  <div className="font-medium mb-1 text-text-primary">Account Type</div>
                  <div className="text-text-tertiary text-sm capitalize">{currentUser.role}</div>
                </div>
                {currentUser.role === "fan" && (
                  <Button
                    onClick={handleCreateCreator}
                    disabled={isCreatingCreator}
                    data-testid="become-creator-button"
                    className="px-4 py-2 bg-brand-primary text-white rounded-xl font-medium hover:bg-brand-primary-subtle transition-all text-sm flex items-center gap-2"
                  >
                    {isCreatingCreator ? (
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Sparkles className="w-4 h-4" aria-hidden="true" />
                    )}
                    {isCreatingCreator ? "Creating..." : "Become Creator"}
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Password Section - Figma Style */}
          <div className="bg-surface-base border border-border-base rounded-2xl p-6 md:p-8 mb-6">
            <h2 className="font-semibold text-lg mb-6 text-text-primary">Security</h2>
            <div className="space-y-4">
              <div>
                <Label
                  htmlFor="oldPassword"
                  className="block mb-2.5 text-sm font-medium text-text-secondary"
                >
                  Current Password
                </Label>
                <Input
                  id="oldPassword"
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-surface-raised border border-border-base rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all"
                  placeholder="Enter current password"
                  autoComplete="current-password"
                />
              </div>
              <div>
                <Label
                  htmlFor="newPassword"
                  className="block mb-2.5 text-sm font-medium text-text-secondary"
                >
                  New Password
                </Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-surface-raised border border-border-base rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all"
                  placeholder="Enter new password (min 8 characters)"
                  autoComplete="new-password"
                />
              </div>
              <div>
                <Label
                  htmlFor="confirmPassword"
                  className="block mb-2.5 text-sm font-medium text-text-secondary"
                >
                  Confirm New Password
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-surface-raised border border-border-base rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all"
                  placeholder="Confirm new password"
                  autoComplete="new-password"
                />
              </div>
              <Button
                onClick={handlePasswordChange}
                disabled={isSaving || !oldPassword || !newPassword || !confirmPassword}
                className="w-full px-4 py-3 bg-brand-primary text-white rounded-xl font-medium hover:bg-brand-primary-subtle transition-all disabled:opacity-50"
                aria-label="Change password"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
                    Updating...
                  </>
                ) : (
                  "Update Password"
                )}
              </Button>
            </div>
          </div>

          {/* Creator Tools - Figma Style */}
          {currentUser.role === "creator" && (
            <div className="bg-surface-base border border-border-base rounded-2xl p-6 md:p-8 mb-6">
              <h2 className="font-semibold text-lg mb-6 text-text-primary">Creator Tools</h2>
              <Button
                onClick={handleSeedPosts}
                disabled={isSeeding}
                variant="outline"
                className="w-full px-4 py-3 bg-surface-raised border border-border-base rounded-xl font-medium hover:bg-surface-overlay transition-all"
                aria-label="Seed demo posts"
              >
                {isSeeding ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
                ) : (
                  <Sparkles className="w-4 h-4 mr-2" aria-hidden="true" />
                )}
                {isSeeding ? "Seeding…" : "Seed demo posts"}
              </Button>
              <p className="text-sm text-text-tertiary mt-2">
                Creates 3 demo posts: subscriber-only, PPV $4.99, PPV $9.99
              </p>
            </div>
          )}

          {/* Danger Zone - Figma Style */}
          <div className="bg-surface-base border border-error/20 rounded-2xl p-6 md:p-8 mb-8">
            <h2 className="font-semibold text-lg mb-6 text-error">Danger Zone</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium mb-1 text-text-primary">Log Out</div>
                  <div className="text-text-tertiary text-sm">Sign out of your account</div>
                </div>
                <Button
                  variant="outline"
                  onClick={handleLogout}
                  className="px-4 py-2 bg-surface-raised border border-border-base rounded-xl font-medium hover:bg-error/10 hover:border-error/30 hover:text-error transition-all text-sm"
                  aria-label="Log out of your account"
                >
                  <LogOut className="w-4 h-4 mr-2" aria-hidden="true" />
                  Log Out
                </Button>
              </div>
            </div>
          </div>

          {/* Save Button - Figma Style */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => setIsEditing(false)}
              disabled={!isEditing}
              className="px-6 py-3 bg-surface-base border border-border-base rounded-xl font-medium hover:bg-surface-raised transition-all"
            >
              Cancel
            </Button>
            {isEditing ? (
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="px-8 py-3 bg-brand-primary text-white rounded-xl font-medium hover:bg-brand-primary-subtle transition-all disabled:opacity-50 shadow-md"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" aria-hidden="true" />
                    Save Changes
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={() => setIsEditing(true)}
                className="px-8 py-3 bg-brand-primary text-white rounded-xl font-medium hover:bg-brand-primary-subtle transition-all shadow-md"
              >
                Edit Profile
              </Button>
            )}
          </div>
        </div>
      </div>

      <BottomNavigation notificationCount={0} userRole={currentUser?.role} />
    </div>
  );
}
