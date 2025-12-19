"use client"

import { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Check, Eye, ArrowLeft } from "lucide-react"
import { NavHeader } from "@/components/nav-header"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function PublishSuccessPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [showConfetti, setShowConfetti] = useState(true)

  const postType = searchParams.get("type") || "subscribers"
  const price = searchParams.get("price") || "0"

  const currentUser = {
    username: "sophia_creative",
    role: "creator" as const,
    avatar: "/creator-avatar.png",
  }

  // Mock post ID for demonstration
  const postId = "demo-post-" + Date.now()

  useEffect(() => {
    setTimeout(() => setShowConfetti(false), 3000)
  }, [])

  const getPostTypeLabel = () => {
    if (postType === "free") return "Free Post"
    if (postType === "subscribers") return "Subscribers-Only Post"
    return `Pay-Per-View Post ($${price})`
  }

  return (
    <div className="min-h-screen bg-background">
      <NavHeader user={currentUser} notificationCount={5} />

      <main className="container max-w-2xl mx-auto px-4 py-12">
        <Card className="p-8 text-center">
          {/* Success Icon */}
          <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-6">
            <Check className="w-10 h-10 text-green-500" />
          </div>

          {/* Success Message */}
          <h1 className="text-3xl font-bold text-foreground mb-3">Post Published Successfully!</h1>
          <p className="text-muted-foreground mb-8">
            Your {getPostTypeLabel().toLowerCase()} is now live and visible to your audience
          </p>

          {/* Post Info */}
          <div className="bg-muted/30 rounded-lg p-6 mb-8 text-left">
            <h3 className="font-semibold text-foreground mb-4">What happens next?</h3>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-foreground font-medium">Post is live on your profile</p>
                  <p className="text-muted-foreground">
                    {postType === "free"
                      ? "Anyone can view this post"
                      : postType === "subscribers"
                        ? "Only your subscribers can see this"
                        : "Fans can purchase to unlock"}
                  </p>
                </div>
              </li>
              {postType !== "free" && (
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-foreground font-medium">Notifications sent</p>
                    <p className="text-muted-foreground">
                      Your {postType === "subscribers" ? "subscribers" : "followers"} will be notified
                    </p>
                  </div>
                </li>
              )}
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-foreground font-medium">Analytics tracking started</p>
                  <p className="text-muted-foreground">Track views, likes, and earnings in your studio</p>
                </div>
              </li>
            </ul>
          </div>

          {/* Primary Actions */}
          <div className="space-y-3 mb-6">
            <Button
              size="lg"
              className="w-full"
              onClick={() => router.push(`/creator/${currentUser.username}?viewAs=fan&postId=${postId}`)}
            >
              <Eye className="w-5 h-5 mr-2" />
              View as Fan
            </Button>
            <p className="text-xs text-muted-foreground">See exactly how fans see your post (locked/unlocked state)</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button asChild variant="outline" size="lg" className="flex-1 bg-transparent">
              <Link href="/creator/studio">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Studio
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="flex-1 bg-transparent">
              <Link href="/creator/studio/post/new">Create Another Post</Link>
            </Button>
          </div>
        </Card>
      </main>
    </div>
  )
}
