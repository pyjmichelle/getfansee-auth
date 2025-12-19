"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { NavHeader } from "@/components/nav-header"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ensureProfile, getCurrentUser } from "@/lib/auth"
import { supabase } from "@/lib/supabase-client"
import { getProfile, setRoleCreator } from "@/lib/profile"
import { listFeed, type Post as PostFromDB } from "@/lib/posts"
import { canViewPost, subscribe30d, hasActiveSubscription, unlockPost } from "@/lib/paywall"
import { MediaDisplay } from "@/components/media-display"
import { Button } from "@/components/ui/button"
import { Lock, Trash2 } from "lucide-react"
import Link from "next/link"
import { deletePost } from "@/lib/posts"

export default function HomePage() {
  const router = useRouter()
  const [posts, setPosts] = useState<PostFromDB[]>([])
  const [feedLoading, setFeedLoading] = useState(true)
  const [feedError, setFeedError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [userProfile, setUserProfile] = useState<{
    role: string
    display_name?: string
    avatar_url?: string
  } | null>(null)
  const [isUpdatingRole, setIsUpdatingRole] = useState(false)
  const [postViewStates, setPostViewStates] = useState<Map<string, boolean>>(new Map())
  const [isSubscribing, setIsSubscribing] = useState<string | null>(null) // creatorId -> loading
  const [isUnlocking, setIsUnlocking] = useState<string | null>(null) // postId -> loading
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null)

  const currentUser = {
    username: userProfile?.display_name || "user",
    role: (userProfile?.role || "fan") as "fan" | "creator",
    avatar: userProfile?.avatar_url || "/fan-user-avatar.jpg",
  }

  // 加载 feed
  const loadFeed = async () => {
    try {
      setFeedLoading(true)
      setFeedError(null)
      const feedPosts = await listFeed(20)
      setPosts(feedPosts)
      
      // 加载每个 post 的可见性状态（在 posts 加载后）
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
      setFeedError("加载 feed 失败")
    } finally {
      setFeedLoading(false)
    }
  }

  // 处理 Subscribe 按钮点击
  const handleSubscribe = async (creatorId: string) => {
    if (!currentUserId || isSubscribing) return

    try {
      setIsSubscribing(creatorId)
      const success = await subscribe30d(creatorId)
      
      if (success) {
        // 重新加载 feed（会自动更新可见性状态）
        await loadFeed()
      } else {
        setFeedError("订阅失败，请重试")
      }
    } catch (err) {
      console.error("[home] handleSubscribe error", err)
      setFeedError("订阅失败，请重试")
    } finally {
      setIsSubscribing(null)
    }
  }

  // 处理 Unlock PPV 按钮点击
  const handleUnlockPPV = async (postId: string) => {
    if (!currentUserId || isUnlocking) return

    try {
      setIsUnlocking(postId)
      const success = await unlockPost(postId)
      
      if (success) {
        // 重新加载 feed（会自动更新可见性状态）
        await loadFeed()
      } else {
        setFeedError("解锁失败，请重试")
      }
    } catch (err) {
      console.error("[home] handleUnlockPPV error", err)
      setFeedError("解锁失败，请重试")
    } finally {
      setIsUnlocking(null)
    }
  }

  // 处理删除 Post
  const handleDeletePost = async (postId: string) => {
    if (!currentUserId || deletingPostId) return

    if (!confirm("确定要删除这条 post 吗？此操作不可撤销。")) {
      return
    }

    try {
      setDeletingPostId(postId)
      const success = await deletePost(postId)
      
      if (success) {
        // 从列表中移除
        setPosts((prev) => prev.filter((p) => p.id !== postId))
      } else {
        setFeedError("删除失败，请重试")
      }
    } catch (err) {
      console.error("[home] handleDeletePost error", err)
      setFeedError("删除失败，请重试")
    } finally {
      setDeletingPostId(null)
    }
  }

  // Phase 1: 暂时移除 paywall state 加载

  // 兜底：确保 profile 存在，避免已有 session 但 profile 缺失导致报错
  useEffect(() => {
    const checkAuthAndProfile = async () => {
      try {
        // 读取 supabase.auth.getSession()，没有 session 就 push /auth
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession()

        if (sessionError || !session) {
          console.log("[home] No session, redirecting to /auth")
          router.push("/auth")
          return
        }

        // 有 session 则 ensureProfile()，保证 profiles 一定存在
        console.log("[home] Has session, ensuring profile for user:", session.user.id)
        await ensureProfile()
        
        // 设置 userId
        setCurrentUserId(session.user.id)
        
        // 加载用户 profile（包含 role）
        const profile = await getProfile(session.user.id)
        if (profile) {
          setUserProfile({
            role: profile.role || "fan",
            display_name: profile.display_name,
            avatar_url: profile.avatar_url || undefined,
          })
        }

        // 加载 feed
        await loadFeed()
      } catch (err) {
        console.error("[home] checkAuthAndProfile error", err)
        // 出错也重定向到登录页，避免卡死
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

  // Phase 1: 暂时移除 paywall error 处理

  // Phase 1: 暂时移除 paywall 相关功能，只做基础 feed 展示

  // Phase 1: 所有 posts 都是公开的
  const filteredPosts = posts

  // 处理 Become a Creator 按钮点击
  const handleBecomeCreator = async () => {
    if (!currentUserId || isUpdatingRole) return

    try {
      setIsUpdatingRole(true)
      const success = await setRoleCreator(currentUserId)
      
      if (success) {
        // 更新本地 state
        setUserProfile((prev) => (prev ? { ...prev, role: "creator" } : { role: "creator" }))
        // 跳转到 onboarding
        router.push("/creator/onboarding")
      } else {
        setFeedError("更新角色失败，请重试")
      }
    } catch (err) {
      console.error("[home] handleBecomeCreator error", err)
      setFeedError("更新角色失败，请重试")
    } finally {
      setIsUpdatingRole(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <NavHeader user={currentUser} notificationCount={3} />

      {/* Become a Creator / Creator Dashboard Button */}
      <div className="container max-w-2xl mx-auto px-4 pt-6">
        {userProfile?.role === "fan" ? (
          <Button
            onClick={handleBecomeCreator}
            disabled={isUpdatingRole}
            className="w-full mb-6"
            size="lg"
          >
            {isUpdatingRole ? "处理中..." : "Become a Creator"}
          </Button>
        ) : userProfile?.role === "creator" ? (
          <Button
            onClick={() => router.push("/creator/onboarding")}
            variant="outline"
            className="w-full mb-6"
            size="lg"
          >
            Creator Dashboard
          </Button>
        ) : null}
      </div>

      <main className="container max-w-2xl mx-auto px-4 py-6">
        {/* Phase 1: 暂时移除 filter 按钮 */}

        {/* Posts Feed */}
        {feedLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading feed...</div>
        ) : feedError ? (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
            <p className="text-destructive font-medium">错误</p>
            <p className="text-sm text-muted-foreground mt-1">{feedError}</p>
            <Button className="mt-4" onClick={loadFeed}>重试</Button>
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">No posts yet. Be the first to create one!</div>
        ) : (
          <div className="space-y-6">
            {filteredPosts.map((post) => (
              <Card key={post.id} className="overflow-hidden">
                {/* Creator Header */}
                <div className="p-4 flex items-center justify-between">
                  <Link href={`/creator/${post.creator_id}`} className="flex items-center gap-3 flex-1">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={post.creator?.avatar_url || "/placeholder.svg"} />
                      <AvatarFallback>
                        {post.creator?.display_name?.[0]?.toUpperCase() || "C"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">
                          {post.creator?.display_name || "Creator"}
                        </span>
                      </div>
                      <span className="text-sm text-muted-foreground">{formatDate(post.created_at)}</span>
                    </div>
                  </Link>
                  {/* Delete Button (Creator 本人) */}
                  {post.creator_id === currentUserId && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeletePost(post.id)}
                      disabled={deletingPostId === post.id}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>

                {/* Post Content */}
                <div className="px-4 pb-3">
                  {post.title && (
                    <h3 className="font-semibold text-foreground mb-2">{post.title}</h3>
                  )}
                  {!postViewStates.get(post.id) && post.creator_id !== currentUserId ? (
                    <div className="bg-muted/50 rounded-lg p-4 text-center">
                      <Lock className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                      {post.visibility === 'subscribers' ? (
                        <>
                          <p className="text-muted-foreground mb-3">This content is for subscribers only</p>
                          <Button
                            size="sm"
                            onClick={() => handleSubscribe(post.creator_id)}
                            disabled={isSubscribing === post.creator_id}
                          >
                            {isSubscribing === post.creator_id ? "处理中..." : "Subscribe to view"}
                          </Button>
                        </>
                      ) : post.visibility === 'ppv' ? (
                        <>
                          <p className="text-muted-foreground mb-3">This content requires payment</p>
                          <Button
                            size="sm"
                            onClick={() => handleUnlockPPV(post.id)}
                            disabled={isUnlocking === post.id}
                          >
                            {isUnlocking === post.id 
                              ? "处理中..." 
                              : `Unlock for $${((post.price_cents || 0) / 100).toFixed(2)}`}
                          </Button>
                        </>
                      ) : (
                        <p className="text-muted-foreground">This content is locked</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-foreground whitespace-pre-wrap">{post.content}</p>
                  )}
                </div>

                {/* Media (Phase 2: 支持多文件) */}
                {(post.media && post.media.length > 0) || post.media_url ? (
                  <div className="px-4 pb-4">
                    <MediaDisplay
                      post={post}
                      canView={postViewStates.get(post.id) === true || post.creator_id === currentUserId}
                      isCreator={post.creator_id === currentUserId}
                      onSubscribe={() => handleSubscribe(post.creator_id)}
                      onUnlock={() => handleUnlockPPV(post.id)}
                      creatorDisplayName={post.creator?.display_name}
                    />
                  </div>
                ) : null}
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Phase 1: 暂时移除 paywall modal */}
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
