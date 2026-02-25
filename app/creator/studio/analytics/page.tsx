"use client";

import { useState } from "react";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Eye,
  Heart,
  DollarSign,
  ChevronRight,
} from "lucide-react";
import { NavHeader } from "@/components/nav-header";
import Link from "next/link";
import { BottomNavigation } from "@/components/bottom-navigation";

type TimeRange = "7d" | "30d" | "90d" | "all";

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");

  const currentUser = {
    username: "sophia_creative",
    role: "creator" as const,
    avatar: "/placeholder.svg?height=100&width=100",
  };

  const stats = {
    views: { value: "12,543", change: "+12.5%", trend: "up" as const },
    uniqueViewers: { value: "8,234", change: "+8.2%", trend: "up" as const },
    engagementRate: { value: "4.2%", change: "-0.3%", trend: "down" as const },
    newSubscribers: { value: "234", change: "+18.7%", trend: "up" as const },
    churnRate: { value: "2.1%", change: "+0.5%", trend: "down" as const },
    earnings: { value: "$2,847", change: "+22.1%", trend: "up" as const },
  };

  const topPosts = [
    {
      id: "1",
      title: "Behind the scenes of my latest shoot",
      views: 3245,
      likes: 892,
      earnings: "$234",
      thumbnail: "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=400",
    },
    {
      id: "2",
      title: "Exclusive tutorial: Advanced techniques",
      views: 2891,
      likes: 765,
      earnings: "$198",
      thumbnail: "https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=400",
    },
    {
      id: "3",
      title: "Q&A session with subscribers",
      views: 2456,
      likes: 643,
      earnings: "$156",
      thumbnail: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400",
    },
  ];

  // Chart data for views
  const viewsData = [420, 380, 520, 480, 650, 590, 720, 680, 820, 760, 890, 950, 880, 1020];
  const maxViews = Math.max(...viewsData);

  // Subscriber growth data
  const subscriberData = [
    45, 52, 48, 61, 58, 69, 72, 68, 78, 82, 89, 95, 103, 98, 112, 118, 125, 132, 138, 145, 152, 148,
    161, 168, 175, 182, 189, 196, 203, 210,
  ];
  const maxSubscribers = Math.max(...subscriberData);

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-0">
      <NavHeader user={currentUser} notificationCount={5} />

      <div className="pt-20 md:pt-24 pb-12">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-4">
              <Link
                href="/creator/studio"
                className="p-2.5 hover:bg-surface-raised rounded-xl transition-colors"
              >
                <ArrowLeft size={24} />
              </Link>
              <div>
                <h1 className="text-3xl font-bold mb-2 text-text-primary">Analytics</h1>
                <p className="text-text-tertiary">
                  Understand your audience and content performance
                </p>
              </div>
            </div>

            {/* Time Range Selector */}
            <div className="flex gap-2 bg-surface-base border border-border-base rounded-xl p-1">
              {[
                { value: "7d" as const, label: "7 Days" },
                { value: "30d" as const, label: "30 Days" },
                { value: "90d" as const, label: "90 Days" },
                { value: "all" as const, label: "All Time" },
              ].map((range) => (
                <button
                  key={range.value}
                  onClick={() => setTimeRange(range.value)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all active:scale-95 ${
                    timeRange === range.value
                      ? "bg-brand-primary text-white shadow-md"
                      : "text-text-secondary hover:bg-surface-raised"
                  }`}
                >
                  {range.label}
                </button>
              ))}
            </div>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            {Object.entries(stats).map(([key, data]) => (
              <div
                key={key}
                className="bg-surface-base border border-border-base rounded-2xl p-5 hover:border-brand-primary/30 transition-all"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-text-tertiary capitalize">
                    {key.replace(/([A-Z])/g, " $1").trim()}
                  </span>
                  <div
                    className={`flex items-center gap-1 text-xs ${
                      data.trend === "up" ? "text-success" : "text-error"
                    }`}
                  >
                    {data.trend === "up" ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                    <span>{data.change}</span>
                  </div>
                </div>
                <div className="text-2xl font-bold text-text-primary">{data.value}</div>
              </div>
            ))}
          </div>

          {/* Charts Row */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {/* Views Chart */}
            <div className="bg-surface-base border border-border-base rounded-2xl p-6">
              <h3 className="font-semibold text-lg mb-6 text-text-primary">Views Over Time</h3>
              <div className="h-64 flex items-end justify-between gap-2">
                {viewsData.map((height, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-brand-primary/20 hover:bg-brand-primary/40 rounded-t transition-all cursor-pointer relative group"
                    style={{ height: `${(height / maxViews) * 100}%` }}
                  >
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-surface-overlay border border-border-strong rounded px-2 py-1 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                      {height} views
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-4 text-xs text-text-tertiary">
                <span>2 weeks ago</span>
                <span>Today</span>
              </div>
            </div>

            {/* Revenue Breakdown */}
            <div className="bg-surface-base border border-border-base rounded-2xl p-6">
              <h3 className="font-semibold text-lg mb-6 text-text-primary">Revenue Breakdown</h3>
              <div className="flex items-center justify-center h-64">
                <div className="relative w-48 h-48">
                  <svg className="w-full h-full" viewBox="0 0 100 100">
                    {/* Subscriptions - 65% */}
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="none"
                      stroke="rgb(107, 114, 255)"
                      strokeWidth="20"
                      strokeDasharray="163 251"
                      transform="rotate(-90 50 50)"
                    />
                    {/* PPV - 30% */}
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="none"
                      stroke="rgb(255, 170, 69)"
                      strokeWidth="20"
                      strokeDasharray="75 251"
                      strokeDashoffset="-163"
                      transform="rotate(-90 50 50)"
                    />
                    {/* Tips - 5% */}
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="none"
                      stroke="rgb(16, 185, 129)"
                      strokeWidth="20"
                      strokeDasharray="13 251"
                      strokeDashoffset="-238"
                      transform="rotate(-90 50 50)"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div className="text-3xl font-bold text-text-primary">$2,847</div>
                    <div className="text-sm text-text-tertiary">Total</div>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-brand-primary" />
                    <span className="text-sm text-text-secondary">Subscriptions</span>
                  </div>
                  <span className="font-semibold text-text-primary">$1,851 (65%)</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-brand-accent" />
                    <span className="text-sm text-text-secondary">PPV Sales</span>
                  </div>
                  <span className="font-semibold text-text-primary">$854 (30%)</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-success" />
                    <span className="text-sm text-text-secondary">Tips</span>
                  </div>
                  <span className="font-semibold text-text-primary">$142 (5%)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Subscribers Growth */}
          <div className="bg-surface-base border border-border-base rounded-2xl p-6 mb-8">
            <h3 className="font-semibold text-lg mb-6 text-text-primary">Subscriber Growth</h3>
            <div className="h-48 flex items-end justify-between gap-1">
              {subscriberData.map((value, i) => (
                <div
                  key={i}
                  className="flex-1 bg-success/30 rounded-t transition-all hover:bg-success/50"
                  style={{ height: `${(value / maxSubscribers) * 100}%` }}
                />
              ))}
            </div>
            <div className="flex items-center justify-between mt-4">
              <span className="text-sm text-text-tertiary">Last 30 days</span>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-success rounded-full" />
                  <span className="text-text-tertiary">
                    New: <span className="font-semibold text-text-primary">234</span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-error rounded-full" />
                  <span className="text-text-tertiary">
                    Churned: <span className="font-semibold text-text-primary">24</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Top Performing Content */}
          <div className="bg-surface-base border border-border-base rounded-2xl p-6">
            <h3 className="font-semibold text-lg mb-6 text-text-primary">Top Performing Content</h3>
            <div className="space-y-4">
              {topPosts.map((post, index) => (
                <div
                  key={post.id}
                  className="flex items-center gap-4 p-4 bg-surface-raised rounded-xl hover:bg-surface-overlay transition-all cursor-pointer"
                >
                  <div className="text-2xl font-bold text-text-quaternary w-8 text-center">
                    #{index + 1}
                  </div>
                  <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-surface-base">
                    <img src={post.thumbnail} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold mb-1 truncate text-text-primary">{post.title}</h4>
                    <div className="flex items-center gap-4 text-sm text-text-tertiary">
                      <span className="flex items-center gap-1">
                        <Eye size={14} />
                        {post.views.toLocaleString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Heart size={14} />
                        {post.likes}
                      </span>
                      <span className="flex items-center gap-1 text-success font-medium">
                        <DollarSign size={14} />
                        {post.earnings}
                      </span>
                    </div>
                  </div>
                  <button className="p-2 hover:bg-surface-base rounded-lg transition-colors active:scale-95">
                    <ChevronRight size={20} className="text-text-tertiary" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <BottomNavigation notificationCount={0} userRole={currentUser.role} />
    </div>
  );
}
