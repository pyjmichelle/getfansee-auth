"use client";

import { useState, useEffect } from "react";
import { User, Mail, Camera, Save, LogOut, Sparkles } from "lucide-react";
import { NavHeader } from "@/components/nav-header";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
      toast.success("头像上传成功");
    } catch (err: any) {
      console.error("[me] avatar upload error:", err);
      toast.error(err.message || "头像上传失败");
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (!currentUserId) return;

    // 验证昵称唯一性（可选，这里简化处理）
    if (username.trim().length > 0 && username.trim().length < 2) {
      toast.error("昵称至少需要 2 个字符");
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
        toast.error("保存失败，请重试");
        return;
      }

      const updateData = await updateResponse.json();
      if (!updateData.success) {
        toast.error("保存失败，请重试");
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
      toast.success("资料更新成功");
    } catch (err) {
      console.error("[me] handleSave error:", err);
      alert("保存失败，请重试");
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
        alert("创建 creator profile 失败，请重试");
        return;
      }

      if (currentUser) {
        setCurrentUser({ ...currentUser, role: "creator" });
      }
      alert("Creator profile 创建成功！");
    } catch (err) {
      console.error("[me] handleCreateCreator error:", err);
      alert("创建失败，请重试");
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
        alert("请先创建 creator profile");
        return;
      }
      const profileData = await profileResponse.json();
      const profile = profileData.profile;
      if (!profile || profile.role !== "creator") {
        alert("请先创建 creator profile");
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
        alert("创建 demo posts 失败，请重试");
        return;
      }

      alert("Demo posts 创建成功！");
    } catch (err) {
      console.error("[me] handleSeedPosts error:", err);
      alert("创建失败，请重试");
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
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const handlePasswordChange = async () => {
    if (!currentUserId) return;

    if (!oldPassword || !newPassword || !confirmPassword) {
      toast.error("请填写所有密码字段");
      return;
    }

    if (newPassword.length < 8) {
      toast.error("新密码至少需要 8 个字符");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("新密码和确认密码不匹配");
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
        toast.error(errorData.error || "密码修改失败，请检查旧密码是否正确");
        return;
      }

      const updateData = await updateResponse.json();
      if (updateData.success) {
        toast.success("密码修改成功");
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        toast.error("密码修改失败，请检查旧密码是否正确");
      }
    } catch (err) {
      console.error("[me] handlePasswordChange error:", err);
      toast.error("密码修改失败，请重试");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505]">
      <NavHeader user={currentUser} notificationCount={0} />

      <main className="container max-w-2xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">Your Profile</h1>
          <p className="text-muted-foreground">Manage your account settings</p>
        </div>

        {/* Profile Card */}
        <Card className="p-6 mb-6">
          <div className="flex flex-col items-center mb-6">
            <div className="relative">
              <Avatar className="w-32 h-32">
                <AvatarImage src={avatar || "/placeholder.svg"} />
                <AvatarFallback className="text-2xl">
                  {username[0]?.toUpperCase() || email[0]?.toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              {isEditing && (
                <label className="absolute bottom-0 right-0 cursor-pointer">
                  <Button
                    size="icon"
                    type="button"
                    className="rounded-full w-10 h-10 bg-primary-gradient hover:shadow-primary-glow"
                    disabled={isUploadingAvatar}
                  >
                    <Camera className="w-5 h-5" />
                  </Button>
                  <input
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    onChange={handleAvatarUpload}
                    className="hidden"
                    disabled={isUploadingAvatar}
                  />
                </label>
              )}
              {isUploadingAvatar && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="flex items-center gap-2">
                <User className="w-4 h-4" />
                Display Name
              </Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={!isEditing}
                className="h-11 bg-[#0D0D0D] border-[#1F1F1F] rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                disabled
                className="h-11 bg-[#121212] border-[#1F1F1F] rounded-xl"
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
                className="min-h-[100px] resize-none bg-[#0D0D0D] border-[#1F1F1F] rounded-xl"
              />
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            {isEditing ? (
              <>
                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                  variant="gradient"
                  className="flex-1 rounded-xl"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {isSaving ? "Saving..." : "Save Changes"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsEditing(false)}
                  disabled={isSaving}
                  className="flex-1 border-[#1F1F1F] bg-[#0D0D0D] hover:bg-[#1A1A1A] rounded-xl"
                >
                  Cancel
                </Button>
              </>
            ) : (
              <Button
                onClick={() => setIsEditing(true)}
                variant="gradient"
                className="w-full rounded-xl"
              >
                Edit Profile
              </Button>
            )}
          </div>
        </Card>

        {/* Password Change Card */}
        <Card className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-3xl p-6 mb-6 hover:border-[#262626] transition-colors">
          <h2 className="text-lg font-semibold text-foreground mb-4">Change Password</h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="oldPassword">Current Password</Label>
              <Input
                id="oldPassword"
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="h-11 bg-[#0D0D0D] border-[#1F1F1F] rounded-xl"
                placeholder="Enter current password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="h-11 bg-[#0D0D0D] border-[#1F1F1F] rounded-xl"
                placeholder="Enter new password (min 8 characters)"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="h-11 bg-[#0D0D0D] border-[#1F1F1F] rounded-xl"
                placeholder="Confirm new password"
              />
            </div>
            <Button
              onClick={handlePasswordChange}
              disabled={isSaving || !oldPassword || !newPassword || !confirmPassword}
              variant="gradient"
              className="w-full rounded-xl"
            >
              {isSaving ? "Changing..." : "Change Password"}
            </Button>
          </div>
        </Card>

        {/* Creator Actions */}
        {currentUser.role === "fan" && (
          <Card className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-3xl p-6 mb-6 hover:border-[#262626] transition-colors">
            <h2 className="text-lg font-semibold text-foreground mb-4">Become a Creator</h2>
            <Button
              onClick={handleCreateCreator}
              disabled={isCreatingCreator}
              variant="gradient"
              className="w-full rounded-xl"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {isCreatingCreator ? "Creating..." : "Create my creator profile"}
            </Button>
          </Card>
        )}

        {currentUser.role === "creator" && (
          <Card className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-3xl p-6 mb-6 hover:border-[#262626] transition-colors">
            <h2 className="text-lg font-semibold text-foreground mb-4">Creator Tools</h2>
            <Button
              onClick={handleSeedPosts}
              disabled={isSeeding}
              variant="outline"
              className="w-full border-[#1F1F1F] bg-[#0D0D0D] hover:bg-[#1A1A1A] rounded-xl"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {isSeeding ? "Seeding..." : "Seed demo posts"}
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              Creates 3 demo posts: subscriber-only, PPV $4.99, PPV $9.99
            </p>
          </Card>
        )}

        {/* Account Actions */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Account Actions</h2>
          <div className="space-y-3">
            <Button
              variant="ghost"
              onClick={handleLogout}
              className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Log Out
            </Button>
          </div>
        </Card>
      </main>
    </div>
  );
}
