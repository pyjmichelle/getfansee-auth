"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { NavHeader } from "@/components/nav-header"
import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getProfile } from "@/lib/profile"
import { listCreatorPosts, type Post } from "@/lib/posts"
import { supabase } from "@/lib/supabase-client"
import { ensureProfile, getCurrentUser } from "@/lib/auth"
import { subscribe30d, cancelSubscription, hasActiveSubscription, canViewPost } from "@/lib/paywall"
import { MediaDisplay } from "@/components/media-display"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function CreatorProfilePage() {
  const params = useParams()
  const router = useRouter()
  const creatorId = params.id as string

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creatorProfile, setCreatorProfile] = useState<{
    id: string
    display_name?: string
    bio?: string
    avatar_url?: string
  } | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [currentUser, setCurrentUser] = useState<{
    username: string
    role: "fan" | "creator"
    avatar?: string
  } | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isSubscribing, setIsSubscribing] = useState(false)
  const [postViewStates, setPostViewStates] = useState<Map<string, boolean>>(new Map())

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true)
        setError(null)

        // 检查认证
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!session) {
          router.push("/auth")
          return
        }

        await ensureProfile()
        setCurrentUserId(session.user.id)

        // 加载当前用户信息（用于 NavHeader）
        const userProfile = await getProfile(session.user.id)
        if (userProfile) {
          setCurrentUser({
            username: userProfile.display_name || "user",
            role: (userProfile.role || "fan") as "fan" | "creator",
            avatar: userProfile.avatar_url || undefined,
          })
        }

        // 检查是否已订阅（如果不是 creator 本人）
        if (session.user.id !== creatorId) {
          const subscribed = await hasActiveSubscription(creatorId)
          setIsSubscribed(subscribed)
        }

        // 加载 creator profile
        const profile = await getProfile(creatorId)
        if (!profile) {
          setError("Creator not found")
          return
        }

        setCreatorProfile({
          id: profile.id,
          display_name: profile.display_name,
          bio: profile.bio,
          avatar_url: profile.avatar_url,
        })

        // 加载 creator posts
        const creatorPosts = await listCreatorPosts(creatorId)
        setPosts(creatorPosts)
        
        // 加载每个 post 的可见性状态
        if (session.user.id) {
          const states = new Map<string, boolean>()
          for (const post of creatorPosts) {
            // Creator 本人永远可见
            if (post.creator_id === session.user.id) {
              states.set(post.id, true)
            } else {
              const canView = await canViewPost(post.id, post.creator_id)
              states.set(post.id, canView)
            }
          }
          setPostViewStates(states)
        }
      } catch (err) {
        console.error("[creator] loadData error", err)
        setError("加载失败，请重试")
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [creatorId, router])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        {currentUser && <NavHeader user={currentUser} notificationCount={0} />}
        <main className="container max-w-2xl mx-auto px-4 py-6">
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        </main>
      </div>
    )
  }

  if (error || !creatorProfile) {
    return (
      <div className="min-h-screen bg-background">
        {currentUser && <NavHeader user={currentUser} notificationCount={0} />}
        <main className="container max-w-2xl mx-auto px-4 py-6">
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
            <p className="text-destructive font-medium">错误</p>
            <p className="text-sm text-muted-foreground mt-1">{error || "Creator not found"}</p>
            <Link href="/home">
              <button className="mt-4 text-sm text-primary hover:underline">返回首页</button>
            </Link>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {currentUser && <NavHeader user={currentUser} notificationCount={0} />}

      <main className="container max-w-2xl mx-auto px-4 py-6">
        {/* Creator Profile Header */}
        <Card className="p-6 mb-6">
          <div className="flex flex-col items-center text-center">
            <Avatar className="w-24 h-24 mb-4">
              <AvatarImage src={creatorProfile.avatar_url || "/placeholder.svg"} />
              <AvatarFallback className="text-2xl">
                {creatorProfile.display_name?.[0]?.toUpperCase() || "C"}
              </AvatarFallback>
            </Avatar>
            <h1 className="text-2xl font-bold text-foreground mb-2">
              {creatorProfile.display_name || "Creator"}
            </h1>
            {creatorProfile.bio && (
              <p className="text-muted-foreground max-w-md mb-4">{creatorProfile.bio}</p>
            )}
            {/* Subscribe Button (仅 fan 可见，且不是 creator 本人) */}
            {currentUserId && currentUserId !== creatorId && (
              <div className="mt-4">
                {isSubscribed ? (
                  <Button
                    variant="outline"
                    onClick={async () => {
                      try {
                        setIsSubscribing(true)
                        const success = await cancelSubscription(creatorId)
                        if (success) {
                          setIsSubscribed(false)
                          // 重新加载 posts（因为 RLS 会隐藏 locked content）
                          const creatorPosts = await listCreatorPosts(creatorId)
                          setPosts(creatorPosts)
                          // 更新可见性状态
                          if (currentUserId) {
                            const states = new Map<string, boolean>()
                            for (const post of creatorPosts) {
                              if (post.creator_id === currentUserId) {
                                states.set(post.id, true)
                              } else {
                                const canView = await canViewPost(post.id, post.creator_id)
                                states.set(post.id, canView)
                              }
                            }
                            setPostViewStates(states)
                          }
                        }
                      } catch (err) {
                        console.error("[creator] cancelSubscription error", err)
                      } finally {
                        setIsSubscribing(false)
                      }
                    }}
                    disabled={isSubscribing}
                  >
                    {isSubscribing ? "处理中..." : "Cancel Subscription"}
                  </Button>
                ) : (
                  <Button
                    onClick={async () => {
                      try {
                        setIsSubscribing(true)
                        const success = await subscribe30d(creatorId)
                        if (success) {
                          setIsSubscribed(true)
                          // 重新加载 posts（因为 RLS 会显示 locked content）
                          const creatorPosts = await listCreatorPosts(creatorId)
                          setPosts(creatorPosts)
                          // 更新可见性状态
                          if (currentUserId) {
                            const states = new Map<string, boolean>()
                            for (const post of creatorPosts) {
                              if (post.creator_id === currentUserId) {
                                states.set(post.id, true)
                              } else {
                                const canView = await canViewPost(post.id, post.creator_id)
                                states.set(post.id, canView)
                              }
                            }
                            setPostViewStates(states)
                          }
                        }
                      } catch (err) {
                        console.error("[creator] subscribe30d error", err)
                      } finally {
                        setIsSubscribing(false)
                      }
                    }}
                    disabled={isSubscribing}
                  >
                    {isSubscribing ? "处理中..." : "Subscribe"}
                  </Button>
                )}
              </div>
            )}
          </div>
        </Card>

        {/* Posts */}
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-foreground">Posts</h2>
          {posts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No posts yet.</div>
          ) : (
            posts.map((post) => {
              const canView = postViewStates.get(post.id) === true || post.creator_id === currentUserId
              
              return (
                <Card key={post.id} className="overflow-hidden">
                  <div className="p-4">
                    {post.title && (
                      <h3 className="font-semibold text-foreground mb-2">{post.title}</h3>
                    )}
                    {canView ? (
                      <p className="text-foreground whitespace-pre-wrap mb-3">{post.content}</p>
                    ) : (
                      <div className="bg-muted/50 rounded-lg p-4 text-center mb-3">
                        <p className="text-muted-foreground mb-3">
                          {post.visibility === 'subscribers' 
                            ? 'This content is for subscribers only'
                            : `Unlock for $${((post.price_cents || 0) / 100).toFixed(2)}`}
                        </p>
                        {post.visibility === 'subscribers' ? (
                          <Button size="sm" onClick={async () => {
                            try {
                              setIsSubscribing(true)
                              const success = await subscribe30d(creatorId)
                              if (success) {
                                setIsSubscribed(true)
                                const creatorPosts = await listCreatorPosts(creatorId)
                                setPosts(creatorPosts)
                                // 更新可见性
                                if (currentUserId) {
                                  const states = new Map<string, boolean>()
                                  for (const p of creatorPosts) {
                                    if (p.creator_id === currentUserId) {
                                      states.set(p.id, true)
                                    } else {
                                      const cv = await canViewPost(p.id, p.creator_id)
                                      states.set(p.id, cv)
                                    }
                                  }
                                  setPostViewStates(states)
                                }
                              }
                            } catch (err) {
                              console.error("[creator] subscribe error", err)
                            } finally {
                              setIsSubscribing(false)
                            }
                          }} disabled={isSubscribing}>
                            {isSubscribing ? "处理中..." : "Subscribe to view"}
                          </Button>
                        ) : (
                          <Button size="sm" onClick={async () => {
                            const { unlockPost } = await import("@/lib/paywall")
                            try {
                              const success = await unlockPost(post.id)
                              if (success && currentUserId) {
                                const creatorPosts = await listCreatorPosts(creatorId)
                                setPosts(creatorPosts)
                                // 更新可见性
                                const states = new Map<string, boolean>()
                                for (const p of creatorPosts) {
                                  if (p.creator_id === currentUserId) {
                                    states.set(p.id, true)
                                  } else {
                                    const cv = await canViewPost(p.id, p.creator_id)
                                    states.set(p.id, cv)
                                  }
                                }
                                setPostViewStates(states)
                              }
                            } catch (err) {
                              console.error("[creator] unlock error", err)
                            }
                          }}>
                            Unlock for ${((post.price_cents || 0) / 100).toFixed(2)}
                          </Button>
                        )}
                      </div>
                    )}
                    
                    {/* Media Display (Phase 2: 支持多文件) */}
                    {((post.media && post.media.length > 0) || post.media_url) && (
                      <div className="mb-3">
                        <MediaDisplay
                          post={post}
                          canView={canView}
                          isCreator={post.creator_id === currentUserId}
                          onSubscribe={async () => {
                            try {
                              setIsSubscribing(true)
                              const success = await subscribe30d(creatorId)
                              if (success) {
                                setIsSubscribed(true)
                                const creatorPosts = await listCreatorPosts(creatorId)
                                setPosts(creatorPosts)
                                // 更新可见性
                                if (currentUserId) {
                                  const states = new Map<string, boolean>()
                                  for (const p of creatorPosts) {
                                    if (p.creator_id === currentUserId) {
                                      states.set(p.id, true)
                                    } else {
                                      const cv = await canViewPost(p.id, p.creator_id)
                                      states.set(p.id, cv)
                                    }
                                  }
                                  setPostViewStates(states)
                                }
                              }
                            } catch (err) {
                              console.error("[creator] subscribe error", err)
                            } finally {
                              setIsSubscribing(false)
                            }
                          }}
                          onUnlock={async () => {
                            const { unlockPost } = await import("@/lib/paywall")
                            try {
                              const success = await unlockPost(post.id)
                              if (success && currentUserId) {
                                const creatorPosts = await listCreatorPosts(creatorId)
                                setPosts(creatorPosts)
                                // 更新可见性
                                const states = new Map<string, boolean>()
                                for (const p of creatorPosts) {
                                  if (p.creator_id === currentUserId) {
                                    states.set(p.id, true)
                                  } else {
                                    const cv = await canViewPost(p.id, p.creator_id)
                                    states.set(p.id, cv)
                                  }
                                }
                                setPostViewStates(states)
                              }
                            } catch (err) {
                              console.error("[creator] unlock error", err)
                            }
                          }}
                          creatorDisplayName={creatorProfile.display_name}
                        />
                      </div>
                    )}
                    
                    <span className="text-sm text-muted-foreground">{formatDate(post.created_at)}</span>
                  </div>
                </Card>
              )
            })
          )}
        </div>
      </main>
    </div>
  )
}

function formatDate(dateString: string) {
  const date = new Date(dateString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))

  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

