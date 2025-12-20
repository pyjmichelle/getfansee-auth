"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { NavHeader } from "@/components/nav-header"
import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ensureProfile, getCurrentUser } from "@/lib/auth"
import { supabase } from "@/lib/supabase-client"
import { getProfile } from "@/lib/profile"
import { listCreators, type Creator } from "@/lib/creators"
import Link from "next/link"

export default function HomePage() {
  const router = useRouter()
  const [creators, setCreators] = useState<Creator[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [userProfile, setUserProfile] = useState<{
    role: string
    display_name?: string
    avatar_url?: string
  } | null>(null)

  const currentUser = {
    username: userProfile?.display_name || "user",
    role: (userProfile?.role || "fan") as "fan" | "creator",
    avatar: userProfile?.avatar_url || "/fan-user-avatar.jpg",
  }

  // Load creators list
  const loadCreators = async () => {
    try {
      setError(null)
      const creatorsList = await listCreators()
      if (creatorsList) {
        setCreators(creatorsList)
      } else {
        setError("无法加载 creators 列表")
      }
    } catch (err) {
      console.error("[home] loadCreators error", err)
      setError("加载失败")
    }
  }

  useEffect(() => {
    const checkAuthAndProfile = async () => {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession()

        if (sessionError || !session) {
          console.log("[home] No session, redirecting to /auth")
          router.push("/auth")
          return
        }

        await ensureProfile()
        setCurrentUserId(session.user.id)

        const profile = await getProfile(session.user.id)
        if (profile) {
          setUserProfile({
            role: profile.role || "fan",
            display_name: profile.display_name,
            avatar_url: profile.avatar_url || undefined,
          })
        }

        await loadCreators()
      } catch (err) {
        console.error("[home] checkAuthAndProfile error", err)
        router.push("/auth")
      } finally {
        setIsLoading(false)
      }
    }
    checkAuthAndProfile()
  }, [router])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <NavHeader user={currentUser} notificationCount={0} />

      <main className="container max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Creators</h1>
          <p className="text-muted-foreground">Discover and subscribe to your favorite creators</p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-destructive/10 text-destructive rounded-lg">
            {error}
          </div>
        )}

        {creators.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">No creators found</p>
            <p className="text-sm text-muted-foreground">
              Visit <Link href="/me" className="text-primary underline">/me</Link> to create your creator profile
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {creators.map((creator) => (
              <Link key={creator.id} href={`/creator/${creator.id}`}>
                <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer">
                  <div className="flex items-center gap-4 mb-4">
                    <Avatar className="w-16 h-16">
                      <AvatarImage src={creator.avatar_url || "/placeholder.svg"} />
                      <AvatarFallback>
                        {creator.display_name?.[0]?.toUpperCase() || "C"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg text-foreground">
                        {creator.display_name}
                      </h3>
                    </div>
                  </div>
                  {creator.bio && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {creator.bio}
                    </p>
                  )}
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
