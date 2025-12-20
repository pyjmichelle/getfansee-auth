"use client"

import { useState, useEffect } from "react"
import { Calendar, DollarSign } from "lucide-react"
import { NavHeader } from "@/components/nav-header"
import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/empty-state"
import { supabase } from "@/lib/supabase-client"
import { ensureProfile, getCurrentUser } from "@/lib/auth"
import { getProfile } from "@/lib/profile"
import { getCreator } from "@/lib/creators"
import { cancelSubscription } from "@/lib/paywall"
import Link from "next/link"
import { useRouter } from "next/navigation"

type Subscription = {
  id: string
  creator_id: string
  plan: string
  status: string
  current_period_end: string
  created_at: string
  creator?: {
    id: string
    display_name: string
    avatar_url?: string
  }
}

export default function SubscriptionsPage() {
  const router = useRouter()
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<{
    username: string
    role: "fan" | "creator"
    avatar?: string
  } | null>(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!session) {
          router.push("/auth")
          return
        }

        await ensureProfile()
        const profile = await getProfile(session.user.id)
        if (profile) {
          setCurrentUser({
            username: profile.display_name || "user",
            role: (profile.role || "fan") as "fan" | "creator",
            avatar: profile.avatar_url || undefined,
          })
        }

        // Load subscriptions
        const { data: subsData, error } = await supabase
          .from("subscriptions")
          .select("*")
          .eq("subscriber_id", session.user.id)
          .order("created_at", { ascending: false })

        if (error) {
          console.error("[subscriptions] load error:", error)
          return
        }

        // Load creator info for each subscription
        const subsWithCreators = await Promise.all(
          (subsData || []).map(async (sub) => {
            const creator = await getCreator(sub.creator_id)
            return {
              ...sub,
              creator: creator || undefined,
            }
          })
        )

        setSubscriptions(subsWithCreators)
      } catch (err) {
        console.error("[subscriptions] loadData error:", err)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [router])

  const handleCancel = async (subscriptionId: string, creatorId: string) => {
    if (!confirm("确定要取消订阅吗？")) return

    try {
      const success = await cancelSubscription(creatorId)
      if (success) {
        setSubscriptions((prev) =>
          prev.map((sub) =>
            sub.id === subscriptionId ? { ...sub, status: "canceled" } : sub
          )
        )
      }
    } catch (err) {
      console.error("[subscriptions] cancel error:", err)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  const getRenewsIn = (endDate: string) => {
    const end = new Date(endDate)
    const now = new Date()
    const diff = end.getTime() - now.getTime()
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24))

    if (days < 0) return "Expired"
    if (days === 0) return "Renews today"
    if (days === 1) return "Renews tomorrow"
    return `Renews in ${days} days`
  }

  if (isLoading || !currentUser) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  const activeSubs = subscriptions.filter((s) => s.status === "active")
  const expiredSubs = subscriptions.filter((s) => s.status !== "active")

  return (
    <div className="min-h-screen bg-background">
      <NavHeader user={currentUser} notificationCount={0} />

      <main className="container max-w-4xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">Your Subscriptions</h1>
          <p className="text-muted-foreground">Manage your creator subscriptions</p>
        </div>

        {subscriptions.length === 0 ? (
          <EmptyState
            icon="heart"
            title="No subscriptions found"
            description="Start following your favorite creators to see them here"
            action={{ label: "Discover Creators", href: "/home" }}
          />
        ) : (
          <div className="space-y-4">
            {subscriptions.map((subscription) => (
              <Card key={subscription.id} className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <Link
                    href={`/creator/${subscription.creator_id}`}
                    className="flex items-center gap-4 flex-1"
                  >
                    <Avatar className="w-16 h-16">
                      <AvatarImage
                        src={subscription.creator?.avatar_url || "/placeholder.svg"}
                      />
                      <AvatarFallback>
                        {subscription.creator?.display_name?.[0]?.toUpperCase() || "C"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-lg text-foreground">
                          {subscription.creator?.display_name || "Creator"}
                        </h3>
                      </div>
                      <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {subscription.status === "active"
                            ? getRenewsIn(subscription.current_period_end)
                            : "Expired"}
                        </div>
                        <div className="flex items-center gap-1">
                          <span>Plan: {subscription.plan}</span>
                        </div>
                      </div>
                    </div>
                  </Link>

                  <div className="flex flex-col items-end gap-3">
                    <Badge variant={subscription.status === "active" ? "default" : "secondary"}>
                      {subscription.status === "active" ? "Active" : "Canceled"}
                    </Badge>
                    {subscription.status === "active" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="bg-transparent"
                        onClick={() => handleCancel(subscription.id, subscription.creator_id)}
                      >
                        Cancel
                      </Button>
                    ) : null}
                  </div>
                </div>

                {subscription.status === "active" && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <p className="text-sm text-muted-foreground">
                      Subscribed since {formatDate(subscription.created_at)} • Next billing on{" "}
                      {formatDate(subscription.current_period_end)}
                    </p>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
