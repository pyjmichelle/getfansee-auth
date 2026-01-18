"use client";

import { useState, useEffect } from "react";
import { User, Mail, Camera, Save, LogOut, Sparkles, Loader2 } from "lucide-react";
import { NavHeader } from "@/components/nav-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LoadingState } from "@/components/loading-state";
import { CenteredContainer } from "@/components/layouts/centered-container";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
// 所有服务器端函数都通过 API 调用，不直接导入
import { uploadAvatar } from "@/lib/storage";
import Link from "next/link";
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
    } catch (err: any) {
      console.error("[me] avatar upload error:", err);
      toast.error(err.message || "Failed to upload avatar");
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
      <div className="min-h-screen bg-background">
        <NavHeader user={currentUser!} notificationCount={0} />
        <CenteredContainer className="py-12">
          <LoadingState type="spinner" text="Loading profile..." />
        </CenteredContainer>
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
    <div className="min-h-screen bg-background">
      <NavHeader user={currentUser!} notificationCount={0} />

      <main className="py-6 sm:py-8 lg:py-12">
        <CenteredContainer maxWidth="2xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl mb-2">Your Profile</h1>
            <p className="text-lg text-muted-foreground">Manage your account settings</p>
          </div>

          {/* Profile Card */}
          <Card className="rounded-xl border shadow-sm mb-6">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center mb-6">
                <div className="relative">
                  <Avatar className="w-32 h-32 ring-4 ring-border">
                    <AvatarImage src={avatar || "/placeholder.svg"} alt="Profile picture" />
                    <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                      {username[0]?.toUpperCase() || email[0]?.toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  {isEditing && (
                    <label className="absolute bottom-0 right-0 cursor-pointer">
                      <Button
                        size="icon"
                        type="button"
                        className="rounded-full w-10 h-10 min-h-[44px] min-w-[44px] bg-primary hover:bg-primary/90"
                        disabled={isUploadingAvatar}
                        aria-label="Upload new avatar"
                      >
                        <Camera className="w-5 h-5" aria-hidden="true" />
                      </Button>
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
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username" className="flex items-center gap-2">
                    <User className="w-4 h-4" aria-hidden="true" />
                    Display Name
                  </Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={!isEditing}
                    className="min-h-[44px] rounded-xl"
                    placeholder="Enter your display name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-2">
                    <Mail className="w-4 h-4" aria-hidden="true" />
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    disabled
                    className="min-h-[44px] rounded-xl bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    Email cannot be changed directly. Contact support to update.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    disabled={!isEditing}
                    placeholder="Tell us about yourself..."
                    className="min-h-[100px] resize-none rounded-xl"
                    maxLength={500}
                  />
                  {isEditing && (
                    <p className="text-xs text-muted-foreground text-right">
                      {bio.length}/500 characters
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                {isEditing ? (
                  <>
                    <Button
                      onClick={handleSave}
                      disabled={isSaving}
                      className="flex-1 rounded-xl min-h-[44px] transition-all duration-200"
                      aria-label="Save profile changes"
                    >
                      {isSaving ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
                      ) : (
                        <Save className="w-4 h-4 mr-2" aria-hidden="true" />
                      )}
                      {isSaving ? "Saving..." : "Save Changes"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setIsEditing(false)}
                      disabled={isSaving}
                      className="flex-1 rounded-xl min-h-[44px] transition-all duration-200"
                      aria-label="Cancel editing"
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={() => setIsEditing(true)}
                    className="w-full rounded-xl min-h-[44px] transition-all duration-200"
                    aria-label="Edit profile"
                  >
                    Edit Profile
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Password Change Card */}
          <Card className="rounded-xl border shadow-sm mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Change Password</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="oldPassword">Current Password</Label>
                <Input
                  id="oldPassword"
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="min-h-[44px] rounded-xl"
                  placeholder="Enter current password"
                  autoComplete="current-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="min-h-[44px] rounded-xl"
                  placeholder="Enter new password (min 8 characters)"
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="min-h-[44px] rounded-xl"
                  placeholder="Confirm new password"
                  autoComplete="new-password"
                />
              </div>
              <Button
                onClick={handlePasswordChange}
                disabled={isSaving || !oldPassword || !newPassword || !confirmPassword}
                className="w-full rounded-xl min-h-[44px] transition-all duration-200"
                aria-label="Change password"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
                    Changing...
                  </>
                ) : (
                  "Change Password"
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Creator Actions */}
          {currentUser.role === "fan" && (
            <Card className="rounded-xl border shadow-sm mb-6">
              <CardHeader>
                <CardTitle className="text-lg">Become a Creator</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Start creating content and monetize your work. Upgrade your account to unlock
                  creator features.
                </p>
                <Button
                  onClick={handleCreateCreator}
                  disabled={isCreatingCreator}
                  className="w-full rounded-xl min-h-[44px] transition-all duration-200"
                  aria-label="Create creator profile"
                >
                  {isCreatingCreator ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
                  ) : (
                    <Sparkles className="w-4 h-4 mr-2" aria-hidden="true" />
                  )}
                  {isCreatingCreator ? "Creating..." : "Create my creator profile"}
                </Button>
              </CardContent>
            </Card>
          )}

          {currentUser.role === "creator" && (
            <Card className="rounded-xl border shadow-sm mb-6">
              <CardHeader>
                <CardTitle className="text-lg">Creator Tools</CardTitle>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={handleSeedPosts}
                  disabled={isSeeding}
                  variant="outline"
                  className="w-full rounded-xl min-h-[44px] transition-all duration-200"
                  aria-label="Seed demo posts"
                >
                  {isSeeding ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
                  ) : (
                    <Sparkles className="w-4 h-4 mr-2" aria-hidden="true" />
                  )}
                  {isSeeding ? "Seeding..." : "Seed demo posts"}
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Creates 3 demo posts: subscriber-only, PPV $4.99, PPV $9.99
                </p>
              </CardContent>
            </Card>
          )}

          {/* Account Actions */}
          <Card className="rounded-xl border shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Account Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                variant="ghost"
                onClick={handleLogout}
                className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10 min-h-[44px] transition-all duration-200 rounded-xl"
                aria-label="Log out of your account"
              >
                <LogOut className="w-4 h-4 mr-2" aria-hidden="true" />
                Log Out
              </Button>
            </CardContent>
          </Card>
        </CenteredContainer>
      </main>
    </div>
  );
}
