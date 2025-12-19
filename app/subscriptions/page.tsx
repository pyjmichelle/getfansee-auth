"use client"

import { useState } from "react"
import { Calendar, DollarSign } from "lucide-react"
import { NavHeader } from "@/components/nav-header"
import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/empty-state"
import type { Subscription } from "@/lib/types"
import Link from "next/link"

// Mock data
const mockSubscriptions: Subscription[] = [
  {
    id: "s1",
    creatorId: "c1",
    creator: {
      id: "c1",
      username: "sophia_creative",
      email: "sophia@example.com",
      role: "creator",
      avatar: "/placeholder.svg?height=100&width=100",
      subscriptionPrice: 9.99,
      isVerified: true,
    },
    status: "active",
    startDate: "2024-01-01T00:00:00Z",
    endDate: "2024-02-01T00:00:00Z",
    price: 9.99,
  },
  {
    id: "s2",
    creatorId: "c2",
    creator: {
      id: "c2",
      username: "alex_pro",
      email: "alex@example.com",
      role: "creator",
      avatar: "/placeholder.svg?height=100&width=100",
      subscriptionPrice: 14.99,
      isVerified: true,
    },
    status: "active",
    startDate: "2024-01-05T00:00:00Z",
    endDate: "2024-02-05T00:00:00Z",
    price: 14.99,
  },
  {
    id: "s3",
    creatorId: "c3",
    creator: {
      id: "c3",
      username: "emma_artist",
      email: "emma@example.com",
      role: "creator",
      avatar: "/placeholder.svg?height=100&width=100",
      subscriptionPrice: 19.99,
      isVerified: false,
    },
    status: "expired",
    startDate: "2023-12-01T00:00:00Z",
    endDate: "2024-01-01T00:00:00Z",
    price: 19.99,
  },
]

export default function SubscriptionsPage() {
  const [subscriptions] = useState(mockSubscriptions)
  const [filter, setFilter] = useState<"all" | "active" | "expired">("all")

  const currentUser = {
    username: "john_doe",
    role: "fan" as const,
    avatar: "/placeholder.svg?height=100&width=100",
  }

  const filteredSubscriptions = subscriptions.filter((sub) => {
    if (filter === "all") return true
    return sub.status === filter
  })

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

  return (
    <div className="min-h-screen bg-background">
      <NavHeader user={currentUser} notificationCount={3} />

      <main className="container max-w-4xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">Your Subscriptions</h1>
          <p className="text-muted-foreground">Manage your creator subscriptions</p>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            onClick={() => setFilter("all")}
            className={filter === "all" ? "" : "bg-transparent"}
          >
            All ({subscriptions.length})
          </Button>
          <Button
            variant={filter === "active" ? "default" : "outline"}
            onClick={() => setFilter("active")}
            className={filter === "active" ? "" : "bg-transparent"}
          >
            Active ({subscriptions.filter((s) => s.status === "active").length})
          </Button>
          <Button
            variant={filter === "expired" ? "default" : "outline"}
            onClick={() => setFilter("expired")}
            className={filter === "expired" ? "" : "bg-transparent"}
          >
            Expired ({subscriptions.filter((s) => s.status === "expired").length})
          </Button>
        </div>

        {/* Subscriptions List */}
        {filteredSubscriptions.length === 0 ? (
          <EmptyState
            icon="heart"
            title="No subscriptions found"
            description="Start following your favorite creators to see them here"
            action={{ label: "Discover Creators", href: "/home" }}
          />
        ) : (
          <div className="space-y-4">
            {filteredSubscriptions.map((subscription) => (
              <Card key={subscription.id} className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <Link href={`/creator/${subscription.creator.username}`} className="flex items-center gap-4 flex-1">
                    <Avatar className="w-16 h-16">
                      <AvatarImage src={subscription.creator.avatar || "/placeholder.svg"} />
                      <AvatarFallback>{subscription.creator.username[0].toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-lg text-foreground">{subscription.creator.username}</h3>
                        {subscription.creator.isVerified && (
                          <svg className="w-5 h-5 text-primary" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <DollarSign className="w-4 h-4" />${subscription.price}/month
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {subscription.status === "active" ? getRenewsIn(subscription.endDate) : "Expired"}
                        </div>
                      </div>
                    </div>
                  </Link>

                  <div className="flex flex-col items-end gap-3">
                    <Badge variant={subscription.status === "active" ? "default" : "secondary"}>
                      {subscription.status === "active" ? "Active" : "Expired"}
                    </Badge>
                    {subscription.status === "active" ? (
                      <Button variant="outline" size="sm" className="bg-transparent">
                        Cancel
                      </Button>
                    ) : (
                      <Button size="sm">Renew</Button>
                    )}
                  </div>
                </div>

                {subscription.status === "active" && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <p className="text-sm text-muted-foreground">
                      Subscribed since {formatDate(subscription.startDate)} • Next billing on{" "}
                      {formatDate(subscription.endDate)}
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
