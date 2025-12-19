"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { NavHeader } from "@/components/nav-header"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Camera } from "lucide-react"
import { supabase } from "@/lib/supabase-client"
import { getProfile, updateCreatorProfile } from "@/lib/profile"
import { ensureProfile } from "@/lib/auth"
import { toast } from "sonner"

export default function CreatorOnboardingPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [profile, setProfile] = useState<{
    role: string
    display_name?: string
    bio?: string
    avatar_url?: string
  } | null>(null)

  const [formData, setFormData] = useState({
    display_name: "",
    bio: "",
    avatar_url: "",
  })

  // 加载用户信息和 profile
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession()

        if (sessionError || !session) {
          router.push("/auth")
          return
        }

        await ensureProfile()
        setCurrentUserId(session.user.id)

        const profileData = await getProfile(session.user.id)
        if (profileData) {
          setProfile(profileData)
          setFormData({
            display_name: profileData.display_name || "",
            bio: profileData.bio || "",
            avatar_url: profileData.avatar_url || "",
          })
        }
      } catch (err) {
        console.error("[onboarding] loadProfile error", err)
        setError("加载 profile 失败")
      } finally {
        setIsLoading(false)
      }
    }

    loadProfile()
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!currentUserId) {
      setError("用户未登录")
      return
    }

    if (!formData.display_name.trim()) {
      setError("Display name 是必填项")
      return
    }

    try {
      setIsSaving(true)
      setError(null)

      const success = await updateCreatorProfile({
        userId: currentUserId,
        display_name: formData.display_name.trim(),
        bio: formData.bio.trim() || undefined,
        avatar_url: formData.avatar_url.trim() || undefined,
      })

      if (success) {
        toast.success("Profile 更新成功！")
        // 等待一下让 toast 显示
        setTimeout(() => {
          router.push("/home")
        }, 500)
      } else {
        setError("更新失败，请重试")
      }
    } catch (err) {
      console.error("[onboarding] handleSubmit error", err)
      setError("更新失败，请重试")
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  const currentUser = {
    username: profile?.display_name || "user",
    role: (profile?.role || "fan") as "fan" | "creator",
    avatar: profile?.avatar_url || "/placeholder.svg",
  }

  return (
    <div className="min-h-screen bg-background">
      <NavHeader user={currentUser} notificationCount={0} />

      <main className="container max-w-2xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">Creator Onboarding</h1>
          <p className="text-muted-foreground">完善你的 creator profile 信息</p>
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-6">
            <p className="text-destructive font-medium">错误</p>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
          </div>
        )}

        <Card className="p-6">
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
                className="mt-2 max-w-md"
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
              />
            </div>

            {/* Submit Button */}
            <div className="flex gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/home")}
                disabled={isSaving}
                className="flex-1"
              >
                取消
              </Button>
              <Button type="submit" disabled={isSaving} className="flex-1">
                {isSaving ? "保存中..." : "保存"}
              </Button>
            </div>
          </form>
        </Card>
      </main>
    </div>
  )
}

