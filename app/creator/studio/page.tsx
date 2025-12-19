"use client"

import { useState } from "react"
import { DollarSign, Users, Eye, Heart, Plus, BarChart3, Calendar, ArrowUpRight, ArrowDownRight } from "lucide-react"
import { NavHeader } from "@/components/nav-header"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"

export default function CreatorStudioPage() {
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d">("30d")

  const currentUser = {
    username: "sophia_creative",
    role: "creator" as const,
    avatar: "/placeholder.svg?height=100&width=100",
  }

  const stats = {
    revenue: { value: 2845.32, change: 12.5, trend: "up" },
    subscribers: { value: 342, change: 8.3, trend: "up" },
    views: { value: 15234, change: -2.1, trend: "down" },
    likes: { value: 3421, change: 15.7, trend: "up" },
  }

  const recentPosts = [
    {
      id: "1",
      type: "subscribers" as const,
      content: "Behind the scenes content",
      mediaUrl: "/placeholder.svg?height=300&width=400",
      createdAt: "2024-01-15T10:30:00Z",
      likes: 234,
      views: 1523,
      revenue: 0,
    },
    {
      id: "2",
      type: "ppv" as const,
      price: 25,
      content: "Premium exclusive content",
      mediaUrl: "/placeholder.svg?height=300&width=400",
      createdAt: "2024-01-14T14:20:00Z",
      likes: 156,
      views: 892,
      revenue: 375,
    },
    {
      id: "3",
      type: "free" as const,
      content: "Check out my latest work!",
      mediaUrl: "/placeholder.svg?height=300&width=400",
      createdAt: "2024-01-13T09:15:00Z",
      likes: 421,
      views: 2341,
      revenue: 0,
    },
  ]

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })
  }

  return (
    <div className="min-h-screen bg-background">
      <NavHeader user={currentUser} notificationCount={5} />

      <main className="container max-w-6xl mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Creator Studio</h1>
            <p className="text-muted-foreground">Manage your content and track performance</p>
          </div>
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link href="/creator/studio/post/new">
              <Plus className="w-5 h-5 mr-2" />
              New Post
            </Link>
          </Button>
        </div>

        {/* Time Range Filter */}
        <div className="flex gap-2 mb-6">
          <Button
            variant={timeRange === "7d" ? "default" : "outline"}
            size="sm"
            onClick={() => setTimeRange("7d")}
            className={timeRange === "7d" ? "" : "bg-transparent"}
          >
            7 Days
          </Button>
          <Button
            variant={timeRange === "30d" ? "default" : "outline"}
            size="sm"
            onClick={() => setTimeRange("30d")}
            className={timeRange === "30d" ? "" : "bg-transparent"}
          >
            30 Days
          </Button>
          <Button
            variant={timeRange === "90d" ? "default" : "outline"}
            size="sm"
            onClick={() => setTimeRange("90d")}
            className={timeRange === "90d" ? "" : "bg-transparent"}
          >
            90 Days
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-lg bg-green-500/10 text-green-500 flex items-center justify-center">
                <DollarSign className="w-6 h-6" />
              </div>
              <div
                className={`flex items-center gap-1 text-sm ${stats.revenue.trend === "up" ? "text-green-500" : "text-red-500"}`}
              >
                {stats.revenue.trend === "up" ? (
                  <ArrowUpRight className="w-4 h-4" />
                ) : (
                  <ArrowDownRight className="w-4 h-4" />
                )}
                {Math.abs(stats.revenue.change)}%
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">${stats.revenue.value.toFixed(2)}</p>
              <p className="text-sm text-muted-foreground">Total Revenue</p>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
              <div
                className={`flex items-center gap-1 text-sm ${stats.subscribers.trend === "up" ? "text-green-500" : "text-red-500"}`}
              >
                {stats.subscribers.trend === "up" ? (
                  <ArrowUpRight className="w-4 h-4" />
                ) : (
                  <ArrowDownRight className="w-4 h-4" />
                )}
                {Math.abs(stats.subscribers.change)}%
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.subscribers.value}</p>
              <p className="text-sm text-muted-foreground">Subscribers</p>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-lg bg-accent/10 text-accent flex items-center justify-center">
                <Eye className="w-6 h-6" />
              </div>
              <div
                className={`flex items-center gap-1 text-sm ${stats.views.trend === "up" ? "text-green-500" : "text-red-500"}`}
              >
                {stats.views.trend === "up" ? (
                  <ArrowUpRight className="w-4 h-4" />
                ) : (
                  <ArrowDownRight className="w-4 h-4" />
                )}
                {Math.abs(stats.views.change)}%
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.views.value.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Total Views</p>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center">
                <Heart className="w-6 h-6" />
              </div>
              <div
                className={`flex items-center gap-1 text-sm ${stats.likes.trend === "up" ? "text-green-500" : "text-red-500"}`}
              >
                {stats.likes.trend === "up" ? (
                  <ArrowUpRight className="w-4 h-4" />
                ) : (
                  <ArrowDownRight className="w-4 h-4" />
                )}
                {Math.abs(stats.likes.change)}%
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.likes.value.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Total Likes</p>
            </div>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <Button asChild variant="outline" className="h-auto py-4 bg-transparent">
            <Link href="/creator/studio/analytics" className="flex items-center gap-3">
              <BarChart3 className="w-5 h-5" />
              <div className="text-left">
                <p className="font-semibold">Analytics</p>
                <p className="text-xs text-muted-foreground">Detailed performance metrics</p>
              </div>
            </Link>
          </Button>

          <Button asChild variant="outline" className="h-auto py-4 bg-transparent">
            <Link href="/creator/studio/subscribers" className="flex items-center gap-3">
              <Users className="w-5 h-5" />
              <div className="text-left">
                <p className="font-semibold">Subscribers</p>
                <p className="text-xs text-muted-foreground">Manage your subscriber base</p>
              </div>
            </Link>
          </Button>

          <Button asChild variant="outline" className="h-auto py-4 bg-transparent">
            <Link href="/creator/studio/earnings" className="flex items-center gap-3">
              <DollarSign className="w-5 h-5" />
              <div className="text-left">
                <p className="font-semibold">Earnings</p>
                <p className="text-xs text-muted-foreground">View revenue and payouts</p>
              </div>
            </Link>
          </Button>
        </div>

        {/* Recent Posts */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-foreground">Recent Posts</h2>
            <Button asChild variant="ghost" size="sm">
              <Link href="/creator/studio/posts">View All</Link>
            </Button>
          </div>

          <div className="space-y-4">
            {recentPosts.map((post) => (
              <Card key={post.id} className="overflow-hidden">
                <div className="flex flex-col md:flex-row">
                  {/* Media Preview */}
                  <div className="relative bg-muted md:w-48 aspect-video md:aspect-auto">
                    <img
                      src={post.mediaUrl || "/placeholder.svg"}
                      alt="Post preview"
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Post Details */}
                  <div className="flex-1 p-4 md:p-6">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant={post.type === "free" ? "secondary" : "default"}>
                            {post.type === "free"
                              ? "Free"
                              : post.type === "subscribers"
                                ? "Subscribers"
                                : `$${post.price}`}
                          </Badge>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(post.createdAt)}
                          </span>
                        </div>
                        <p className="text-foreground mb-3">{post.content}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-6 text-sm">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Eye className="w-4 h-4" />
                        {post.views.toLocaleString()} views
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Heart className="w-4 h-4" />
                        {post.likes} likes
                      </div>
                      {post.revenue > 0 && (
                        <div className="flex items-center gap-1 text-green-500">
                          <DollarSign className="w-4 h-4" />${post.revenue}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-4 md:p-6 flex md:flex-col gap-2 border-t md:border-t-0 md:border-l border-border">
                    <Button size="sm" variant="outline" className="flex-1 md:flex-none bg-transparent">
                      Edit
                    </Button>
                    <Button size="sm" variant="ghost" className="flex-1 md:flex-none">
                      View
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
