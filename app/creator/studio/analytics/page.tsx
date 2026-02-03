"use client";

import { useState } from "react";
import { ArrowLeft, TrendingUp, Users, Eye, Heart, DollarSign } from "lucide-react";
import { NavHeader } from "@/components/nav-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d" | "all">("30d");

  const currentUser = {
    username: "sophia_creative",
    role: "creator" as const,
    avatar: "/placeholder.svg?height=100&width=100",
  };

  const topPosts = [
    {
      id: "1",
      content: "Behind the scenes of my latest project",
      views: 5234,
      likes: 892,
      revenue: 450,
      type: "ppv" as const,
    },
    {
      id: "2",
      content: "Exclusive tutorial for subscribers",
      views: 3421,
      likes: 654,
      revenue: 0,
      type: "subscribers" as const,
    },
    {
      id: "3",
      content: "Free preview of upcoming content",
      views: 8945,
      likes: 1234,
      revenue: 0,
      type: "free" as const,
    },
  ];

  const audienceStats = {
    byAge: [
      { range: "18-24", percentage: 35 },
      { range: "25-34", percentage: 45 },
      { range: "35-44", percentage: 15 },
      { range: "45+", percentage: 5 },
    ],
    byCountry: [
      { country: "United States", percentage: 45 },
      { country: "United Kingdom", percentage: 20 },
      { country: "Canada", percentage: 12 },
      { country: "Australia", percentage: 8 },
      { country: "Other", percentage: 15 },
    ],
  };

  return (
    <div className="min-h-screen bg-background">
      <NavHeader user={currentUser} notificationCount={5} />

      <main className="container max-w-6xl mx-auto px-4 py-6">
        <Button asChild variant="ghost" size="sm" className="mb-6">
          <Link href="/creator/studio">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Studio
          </Link>
        </Button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Analytics</h1>
          <p className="text-muted-foreground">Track your performance and audience insights</p>
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
          <Button
            variant={timeRange === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setTimeRange("all")}
            className={timeRange === "all" ? "" : "bg-transparent"}
          >
            All Time
          </Button>
        </div>

        {/* Performance Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="p-6 lg:p-8 rounded-2xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Eye className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">15.2K</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Total Views</p>
          </Card>

          <Card className="p-6 lg:p-8 rounded-2xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-[var(--bg-pink-500-10)] text-[var(--color-pink-500)] flex items-center justify-center">
                <Heart className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">3.4K</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Total Likes</p>
          </Card>

          <Card className="p-6 lg:p-8 rounded-2xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 text-green-500 flex items-center justify-center">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">4.5%</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Engagement Rate</p>
          </Card>

          <Card className="p-6 lg:p-8 rounded-2xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-accent/10 text-accent flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">342</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Active Subscribers</p>
          </Card>
        </div>

        {/* Top Performing Posts */}
        <Card className="p-6 mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">Top Performing Posts</h2>
          <div className="space-y-4">
            {topPosts.map((post, index) => (
              <div key={post.id} className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold flex-shrink-0">
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-foreground font-medium mb-1 truncate">{post.content}</p>
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Eye className="w-4 h-4" />
                      {post.views.toLocaleString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <Heart className="w-4 h-4" />
                      {post.likes.toLocaleString()}
                    </span>
                    {post.revenue > 0 && (
                      <span className="flex items-center gap-1 text-green-500">
                        <DollarSign className="w-4 h-4" />${post.revenue}
                      </span>
                    )}
                  </div>
                </div>
                <Badge variant={post.type === "free" ? "secondary" : "default"}>
                  {post.type === "free"
                    ? "Free"
                    : post.type === "subscribers"
                      ? "Exclusive"
                      : "Premium"}
                </Badge>
              </div>
            ))}
          </div>
        </Card>

        {/* Audience Demographics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="p-6 lg:p-8 rounded-2xl">
            <h2 className="text-lg font-semibold text-foreground mb-4">Audience by Age</h2>
            <div className="space-y-4">
              {audienceStats.byAge.map((stat) => (
                <div key={stat.range}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-foreground">{stat.range}</span>
                    <span className="text-sm font-medium text-foreground">{stat.percentage}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-primary rounded-full h-2 transition-[width] motion-safe:transition-[width] motion-reduce:transition-none"
                      style={{ width: `${stat.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6 lg:p-8 rounded-2xl">
            <h2 className="text-lg font-semibold text-foreground mb-4">Audience by Country</h2>
            <div className="space-y-4">
              {audienceStats.byCountry.map((stat) => (
                <div key={stat.country}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-foreground">{stat.country}</span>
                    <span className="text-sm font-medium text-foreground">{stat.percentage}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-accent rounded-full h-2 transition-[width] motion-safe:transition-[width] motion-reduce:transition-none"
                      style={{ width: `${stat.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
