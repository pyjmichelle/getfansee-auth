"use client"

import { useState, useEffect } from "react"
import { User, Mail, Camera, Save, LogOut, Sparkles } from "lucide-react"
import { NavHeader } from "@/components/nav-header"
import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { supabase } from "@/lib/supabase-client"
import { ensureProfile, getCurrentUser } from "@/lib/auth"
import { getProfile, setRoleCreator } from "@/lib/profile"
import Link from "next/link"
import { useRouter } from "next/navigation"

export default function ProfilePage() {
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isCreatingCreator, setIsCreatingCreator] = useState(false)
  const [isSeeding, setIsSeeding] = useState(false)
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [bio, setBio] = useState("")
  const [avatar, setAvatar] = useState("")
  const [currentUser, setCurrentUser] = useState<{
    username: string
    role: "fan" | "creator"
    avatar?: string
  } | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!session) {
          router.push("/auth")
          return
        }

        await ensureProfile()
        setCurrentUserId(session.user.id)
        setEmail(session.user.email || "")

        const profile = await getProfile(session.user.id)
        if (profile) {
          setUsername(profile.display_name || "")
          setBio(profile.bio || "")
          setAvatar(profile.avatar_url || "")
          setCurrentUser({
            username: profile.display_name || "user",
            role: (profile.role || "fan") as "fan" | "creator",
            avatar: profile.avatar_url || undefined,
          })
        }
      } catch (err) {
        console.error("[me] loadProfile error:", err)
      } finally {
        setIsLoading(false)
      }
    }

    loadProfile()
  }, [router])

  const handleSave = async () => {
    if (!currentUserId) return

    setIsSaving(true)
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: username,
          bio: bio,
          avatar_url: avatar || null,
        })
        .eq("id", currentUserId)

      if (error) {
        console.error("[me] save error:", error)
        alert("保存失败，请重试")
        return
      }

      setIsEditing(false)
      if (currentUser) {
        setCurrentUser({
          ...currentUser,
          username: username,
          avatar: avatar,
        })
      }
    } catch (err) {
      console.error("[me] handleSave error:", err)
      alert("保存失败，请重试")
    } finally {
      setIsSaving(false)
    }
  }

  const handleCreateCreator = async () => {
    if (!currentUserId || isCreatingCreator) return

    setIsCreatingCreator(true)
    try {
      // Set role to creator
      const success = await setRoleCreator(currentUserId)
      if (!success) {
        alert("创建 creator profile 失败，请重试")
        return
      }

      // Create creator record
      const { error: creatorError } = await supabase.from("creators").upsert(
        {
          id: currentUserId,
          display_name: username || email.split("@")[0],
          bio: bio || null,
          avatar_url: avatar || null,
        },
        { onConflict: "id" }
      )

      if (creatorError) {
        console.error("[me] create creator error:", creatorError)
        alert("创建 creator profile 失败，请重试")
        return
      }

      if (currentUser) {
        setCurrentUser({ ...currentUser, role: "creator" })
      }
      alert("Creator profile 创建成功！")
    } catch (err) {
      console.error("[me] handleCreateCreator error:", err)
      alert("创建失败，请重试")
    } finally {
      setIsCreatingCreator(false)
    }
  }

  const handleSeedPosts = async () => {
    if (!currentUserId || isSeeding) return

    setIsSeeding(true)
    try {
      // Check if user is creator
      const profile = await getProfile(currentUserId)
      if (!profile || profile.role !== "creator") {
        alert("请先创建 creator profile")
        return
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
      ]

      const { error } = await supabase.from("posts").insert(posts)

      if (error) {
        console.error("[me] seed posts error:", error)
        alert("创建 demo posts 失败，请重试")
        return
      }

      alert("Demo posts 创建成功！")
    } catch (err) {
      console.error("[me] handleSeedPosts error:", err)
      alert("创建失败，请重试")
    } finally {
      setIsSeeding(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/auth")
  }

  if (isLoading || !currentUser) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
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
                <Button
                  size="icon"
                  className="absolute bottom-0 right-0 rounded-full w-10 h-10"
                  onClick={() => {
                    // TODO: Implement avatar upload
                    console.log("Avatar upload triggered")
                  }}
                >
                  <Camera className="w-5 h-5" />
                </Button>
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
                className="h-11"
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
                className="h-11 bg-muted"
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
                className="min-h-[100px] resize-none"
              />
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            {isEditing ? (
              <>
                <Button onClick={handleSave} disabled={isSaving} className="flex-1">
                  <Save className="w-4 h-4 mr-2" />
                  {isSaving ? "Saving..." : "Save Changes"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsEditing(false)}
                  disabled={isSaving}
                  className="flex-1 bg-transparent"
                >
                  Cancel
                </Button>
              </>
            ) : (
              <Button onClick={() => setIsEditing(true)} className="w-full">
                Edit Profile
              </Button>
            )}
          </div>
        </Card>

        {/* Creator Actions */}
        {currentUser.role === "fan" && (
          <Card className="p-6 mb-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Become a Creator</h2>
            <Button
              onClick={handleCreateCreator}
              disabled={isCreatingCreator}
              className="w-full"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {isCreatingCreator ? "Creating..." : "Create my creator profile"}
            </Button>
          </Card>
        )}

        {currentUser.role === "creator" && (
          <Card className="p-6 mb-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Creator Tools</h2>
            <Button
              onClick={handleSeedPosts}
              disabled={isSeeding}
              variant="outline"
              className="w-full"
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
  )
}
