"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { NavHeader } from "@/components/nav-header"
import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { ensureProfile, getCurrentUser } from "@/lib/auth"
import { supabase } from "@/lib/supabase-client"
import { getProfile } from "@/lib/profile"
import { listFeed, type Post } from "@/lib/posts"
import { canViewPost, subscribe30d, unlockPost } from "@/lib/paywall"
import { MediaDisplay } from "@/components/media-display"
import Link from "next/link"
import { Lock, Heart, MessageCircle, Share2 } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

export default function HomePage() {
  const router = useRouter()
  const [posts, setPosts] = useState<Post[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [userProfile, setUserProfile] = useState<{
    role: string
    display_name?: string
    avatar_url?: string
  } | null>(null)
  const [postViewStates, setPostViewStates] = useState<Map<string, boolean>>(new Map())
  const [subscribingCreators, setSubscribingCreators] = useState<Set<string>>(new Set())
  const [unlockingPosts, setUnlockingPosts] = useState<Set<string>>(new Set())

  const currentUser = {
    username: userProfile?.display_name || "user",
    role: (userProfile?.role || "fan") as "fan" | "creator",
    avatar: userProfile?.avatar_url || "/fan-user-avatar.jpg",
  }

  // Load feed
  const loadFeed = async () => {
    try {
      setError(null)
      const feedPosts = await listFeed(20)
      setPosts(feedPosts)

      // 检查每个 post 的可见性
      if (currentUserId) {
        const states = new Map<string, boolean>()
        for (const post of feedPosts) {
          // Creator 本人永远可见
          if (post.creator_id === currentUserId) {
            states.set(post.id, true)
          } else {
            const canView = await canViewPost(post.id, post.creator_id)
            states.set(post.id, canView)
          }
        }
        setPostViewStates(states)
      }
    } catch (err) {
      console.error("[home] loadFeed error", err)
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

        await loadFeed()
      } catch (err) {
        console.error("[home] checkAuthAndProfile error", err)
        router.push("/auth")
      } finally {
        setIsLoading(false)
      }
    }
    checkAuthAndProfile()
  }, [router])

  const handleSubscribe = async (creatorId: string) => {
    try {
      setSubscribingCreators((prev) => new Set(prev).add(creatorId))
      const success = await subscribe30d(creatorId)
      if (success) {
        // 重新加载 feed 和可见性状态
        await loadFeed()
      }
    } catch (err) {
      console.error("[home] subscribe error", err)
    } finally {
      setSubscribingCreators((prev) => {
        const next = new Set(prev)
        next.delete(creatorId)
        return next
      })
    }
  }

  const handleUnlockPPV = async (postId: string, creatorId: string, priceCents: number) => {
    try {
      setUnlockingPosts((prev) => new Set(prev).add(postId))
      const success = await unlockPost(postId, priceCents)
      if (success) {
        // 更新可见性状态
        setPostViewStates((prev) => {
          const next = new Map(prev)
          next.set(postId, true)
          return next
        })
        // 重新加载 feed
        await loadFeed()
      }
    } catch (err) {
      console.error("[home] unlock error", err)
    } finally {
      setUnlockingPosts((prev) => {
        const next = new Set(prev)
        next.delete(postId)
        return next
      })
    }
  }

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

      <main className="container max-w-4xl mx-auto px-4 py-8">
        <div className="mb-4 p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
          <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">
            LIVE VERSION: 70a5ada
          </p>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Feed</h1>
          <p className="text-muted-foreground">Discover content from creators</p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-destructive/10 text-destructive rounded-lg">
            {error}
          </div>
        )}

        {posts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">No posts found</p>
            <p className="text-sm text-muted-foreground">
              Visit <Link href="/me" className="text-primary underline">/me</Link> to create your creator profile and start posting
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {posts.map((post) => {
              const canView = postViewStates.get(post.id) ?? false
              const isCreator = post.creator_id === currentUserId
              const isSubscribing = subscribingCreators.has(post.creator_id)
              const isUnlocking = unlockingPosts.has(post.id)

              return (
                <Card key={post.id} className="p-6">
                  {/* Creator Header */}
                  <div className="flex items-center gap-3 mb-4">
                    <Link href={`/creator/${post.creator_id}`}>
                      <Avatar className="w-10 h-10 cursor-pointer hover:opacity-80 transition-opacity">
                        <AvatarImage 
                          src={post.creator?.avatar_url || "/placeholder.svg"} 
                          alt={post.creator?.display_name || "Creator"}
                          onError={(e) => {
                            // 如果图片加载失败，使用 fallback
                            const target = e.target as HTMLImageElement
                            target.style.display = 'none'
                          }}
                        />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {post.creator?.display_name?.[0]?.toUpperCase() || "C"}
                        </AvatarFallback>
                      </Avatar>
                    </Link>
                    <div className="flex-1">
                      <Link href={`/creator/${post.creator_id}`}>
                        <h3 className="font-semibold text-foreground hover:text-primary transition-colors">
                          {post.creator?.display_name || "Creator"}
                        </h3>
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>

                  {/* Post Content */}
                  {post.title && (
                    <h2 className="text-xl font-semibold text-foreground mb-2">{post.title}</h2>
                  )}
                  <p className="text-foreground mb-4 whitespace-pre-wrap">{post.content}</p>

                  {/* Media Display */}
                  <div className="mb-4">
                    <MediaDisplay
                      post={post}
                      canView={canView || isCreator}
                      isCreator={isCreator}
                      onSubscribe={() => handleSubscribe(post.creator_id)}
                      onUnlock={() => handleUnlockPPV(post.id, post.creator_id, post.price_cents || 0)}
                      creatorDisplayName={post.creator?.display_name}
                    />
                  </div>

                  {/* Locked State Actions */}
                  {!canView && !isCreator && (
                    <div className="mt-4 p-4 bg-muted rounded-lg">
                      {post.visibility === 'subscribers' ? (
                        <div className="text-center">
                          <Lock className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground mb-3">
                            This content is for subscribers only
                          </p>
                          <Button
                            onClick={() => handleSubscribe(post.creator_id)}
                            disabled={isSubscribing}
                            size="sm"
                          >
                            {isSubscribing ? "处理中..." : "Subscribe to view"}
                          </Button>
                        </div>
                      ) : post.visibility === 'ppv' ? (
                        <div className="text-center">
                          <Lock className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground mb-3">
                            Unlock this post for ${((post.price_cents || 0) / 100).toFixed(2)}
                          </p>
                          <Button
                            onClick={() => handleUnlockPPV(post.id, post.creator_id, post.price_cents || 0)}
                            disabled={isUnlocking}
                            size="sm"
                          >
                            {isUnlocking ? "处理中..." : `Unlock for $${((post.price_cents || 0) / 100).toFixed(2)}`}
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  )}

                  {/* Post Actions */}
                  <div className="flex items-center gap-4 pt-4 border-t border-border">
                    <Button variant="ghost" size="sm" className="gap-2">
                      <Heart className="w-4 h-4" />
                      Like
                    </Button>
                    <Button variant="ghost" size="sm" className="gap-2">
                      <MessageCircle className="w-4 h-4" />
                      Comment
                    </Button>
                    <Button variant="ghost" size="sm" className="gap-2">
                      <Share2 className="w-4 h-4" />
                      Share
                    </Button>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
