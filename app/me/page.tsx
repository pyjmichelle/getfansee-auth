"use client"

import { useState } from "react"
import { User, Mail, Camera, Save, LogOut } from "lucide-react"
import { NavHeader } from "@/components/nav-header"
import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import Link from "next/link"

export default function ProfilePage() {
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [username, setUsername] = useState("john_doe")
  const [email, setEmail] = useState("john@example.com")
  const [bio, setBio] = useState("Fan of amazing creators")
  const [avatar, setAvatar] = useState("/placeholder.svg?height=200&width=200")

  const currentUser = {
    username: "john_doe",
    role: "fan" as const,
    avatar: "/placeholder.svg?height=100&width=100",
  }

  const handleSave = async () => {
    setIsSaving(true)
    // Simulate API call
    setTimeout(() => {
      setIsSaving(false)
      setIsEditing(false)
    }, 1000)
  }

  const handleAvatarUpload = () => {
    // Simulate file upload
    console.log("Avatar upload triggered")
  }

  return (
    <div className="min-h-screen bg-background">
      <NavHeader user={currentUser} notificationCount={3} />

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
                <AvatarFallback className="text-2xl">{username[0].toUpperCase()}</AvatarFallback>
              </Avatar>
              {isEditing && (
                <Button
                  size="icon"
                  className="absolute bottom-0 right-0 rounded-full w-10 h-10"
                  onClick={handleAvatarUpload}
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
                Username
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
                onChange={(e) => setEmail(e.target.value)}
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

        {/* Settings Card */}
        <Card className="p-6 mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Settings</h2>
          <div className="space-y-3">
            <Button asChild variant="ghost" className="w-full justify-start">
              <Link href="/me/security">Security & Password</Link>
            </Button>
            <Button asChild variant="ghost" className="w-full justify-start">
              <Link href="/me/payment">Payment Methods</Link>
            </Button>
            <Button asChild variant="ghost" className="w-full justify-start">
              <Link href="/me/notifications">Notification Preferences</Link>
            </Button>
            <Button asChild variant="ghost" className="w-full justify-start">
              <Link href="/me/privacy">Privacy Settings</Link>
            </Button>
          </div>
        </Card>

        {/* Account Actions */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Account Actions</h2>
          <div className="space-y-3">
            <Button
              variant="ghost"
              className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Log Out
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              Delete Account
            </Button>
          </div>
        </Card>
      </main>
    </div>
  )
}
