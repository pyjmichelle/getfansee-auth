"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Search, Calendar, DollarSign, MoreVertical } from "lucide-react";
import { NavHeader } from "@/components/nav-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { ensureProfile } from "@/lib/auth";
import { getProfile } from "@/lib/profile";
// listSubscribers 通过 API 调用，不直接导入
import Link from "next/link";
import { formatDistanceToNow, format } from "date-fns";

const supabase = getSupabaseBrowserClient();

interface Subscriber {
  id: string;
  fan_id: string;
  fan_display_name: string | null;
  fan_avatar_url: string | null;
  status: string;
  starts_at: string;
  ends_at: string;
  cancelled_at: string | null;
  created_at: string;
}

export default function SubscribersPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "will_cancel" | "canceled">("all");
  const [currentUser, setCurrentUser] = useState<{
    username: string;
    role: "fan" | "creator";
    avatar?: string;
  } | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          router.push("/auth");
          return;
        }

        await ensureProfile();
        setCurrentUserId(session.user.id);

        const profile = await getProfile(session.user.id);
        if (profile) {
          setCurrentUser({
            username: profile.display_name || "user",
            role: (profile.role || "fan") as "fan" | "creator",
            avatar: profile.avatar_url || undefined,
          });

          if (profile.role !== "creator") {
            router.push("/home");
            return;
          }

          // 加载订阅者列表（通过 API）
          const response = await fetch("/api/paywall/subscribers");
          if (response.ok) {
            const data = await response.json();
            setSubscribers(data.subscribers || []);
          } else {
            console.error("[subscribers] Failed to fetch subscribers");
          }
        }
      } catch (err) {
        console.error("[subscribers] loadData error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [router]);

  const getSubscriberStatus = (sub: Subscriber): "active" | "will_cancel" | "canceled" => {
    if (sub.status === "canceled" || sub.cancelled_at) {
      return "canceled";
    }
    // 检查是否即将到期（7天内）
    const endsAt = new Date(sub.ends_at);
    const now = new Date();
    const daysUntilEnd = Math.ceil((endsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntilEnd <= 7 && daysUntilEnd > 0) {
      return "will_cancel";
    }
    return "active";
  };

  const filteredSubscribers = subscribers.filter((sub) => {
    const matchesSearch =
      sub.fan_display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.fan_id.toLowerCase().includes(searchQuery.toLowerCase());
    const status = getSubscriberStatus(sub);
    const matchesFilter = filter === "all" || status === filter;
    return matchesSearch && matchesFilter;
  });

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "MMM d, yyyy");
  };

  const getStatusBadge = (status: "active" | "will_cancel" | "canceled") => {
    switch (status) {
      case "active":
        return (
          <Badge className="bg-green-500/10 text-green-600 dark:text-green-400 border-[#10B981]/20 rounded-lg">
            Active
          </Badge>
        );
      case "will_cancel":
        return (
          <Badge className="bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20 rounded-lg">
            Expiring Soon
          </Badge>
        );
      case "canceled":
        return (
          <Badge className="bg-[#F43F5E]/10 text-destructive border-[#F43F5E]/20 rounded-lg">
            Cancelled
          </Badge>
        );
      default:
        return null;
    }
  };

  const activeCount = subscribers.filter((s) => getSubscriberStatus(s) === "active").length;
  const willCancelCount = subscribers.filter(
    (s) => getSubscriberStatus(s) === "will_cancel"
  ).length;
  const canceledCount = subscribers.filter((s) => getSubscriberStatus(s) === "canceled").length;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        {currentUser && <NavHeader user={currentUser} notificationCount={0} />}
        <main className="container max-w-6xl mx-auto px-4 py-6">
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-[#121212] rounded-3xl"></div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {currentUser && <NavHeader user={currentUser} notificationCount={0} />}

      <main className="container max-w-6xl mx-auto px-4 md:px-8 py-8 md:py-12">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="mb-6 border-border bg-card hover:bg-[#1A1A1A] rounded-xl"
        >
          <Link href="/creator/studio">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Studio
          </Link>
        </Button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Subscribers</h1>
          <p className="text-muted-foreground">Manage your subscriber base</p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 mb-8">
          <div className="bg-card border border-border rounded-3xl p-6">
            <p className="text-sm text-muted-foreground mb-1">Total Subscribers</p>
            <p className="text-3xl font-bold text-foreground">{subscribers.length}</p>
          </div>
          <div className="bg-card border border-border rounded-3xl p-6">
            <p className="text-sm text-muted-foreground mb-1">Active</p>
            <p className="text-3xl font-bold text-green-600 dark:text-green-400">{activeCount}</p>
          </div>
          <div className="bg-card border border-border rounded-3xl p-6">
            <p className="text-sm text-muted-foreground mb-1">Expiring Soon</p>
            <p className="text-3xl font-bold text-[#F59E0B]">{willCancelCount}</p>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search subscribers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-11 bg-card border-border rounded-xl"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
            <Button
              variant={filter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("all")}
              className={`rounded-xl ${
                filter === "all"
                  ? "bg-primary-gradient"
                  : "border-border bg-card hover:bg-[#1A1A1A]"
              }`}
            >
              All
            </Button>
            <Button
              variant={filter === "active" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("active")}
              className={`rounded-xl ${
                filter === "active"
                  ? "bg-primary-gradient"
                  : "border-border bg-card hover:bg-[#1A1A1A]"
              }`}
            >
              Active
            </Button>
            <Button
              variant={filter === "will_cancel" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("will_cancel")}
              className={`rounded-xl ${
                filter === "will_cancel"
                  ? "bg-primary-gradient"
                  : "border-border bg-card hover:bg-[#1A1A1A]"
              }`}
            >
              Expiring
            </Button>
            <Button
              variant={filter === "canceled" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("canceled")}
              className={`rounded-xl ${
                filter === "canceled"
                  ? "bg-primary-gradient"
                  : "border-border bg-card hover:bg-[#1A1A1A]"
              }`}
            >
              Cancelled
            </Button>
          </div>
        </div>

        {/* Subscribers List */}
        {filteredSubscribers.length === 0 ? (
          <div className="bg-card border border-border rounded-3xl p-12 text-center">
            <p className="text-muted-foreground">No subscribers found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredSubscribers.map((subscriber) => {
              const status = getSubscriberStatus(subscriber);
              const displayName =
                subscriber.fan_display_name || `User ${subscriber.fan_id.slice(0, 8)}`;

              return (
                <div
                  key={subscriber.id}
                  className="bg-card border border-border rounded-3xl p-4 md:p-6 hover:border-[#262626] transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={subscriber.fan_avatar_url || "/placeholder.svg"} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {displayName[0]?.toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-foreground">{displayName}</p>
                        {getStatusBadge(status)}
                      </div>
                      <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          Started {formatDate(subscriber.starts_at)}
                        </span>
                        {status === "canceled" && subscriber.cancelled_at ? (
                          <span className="flex items-center gap-1 text-destructive">
                            Cancelled on {formatDate(subscriber.cancelled_at)}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            Expires {formatDate(subscriber.ends_at)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="hidden sm:flex flex-col items-end gap-1">
                      {status === "canceled" ? (
                        <p className="text-sm text-muted-foreground">Cancelled</p>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {status === "will_cancel" ? "Expires" : "Renews"}{" "}
                          {formatDate(subscriber.ends_at)}
                        </p>
                      )}
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="rounded-xl">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-card border-border">
                        <DropdownMenuItem asChild>
                          <Link href={`/creator/${subscriber.fan_id}`}>View Profile</Link>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
