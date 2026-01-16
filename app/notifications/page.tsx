"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bell, Heart, DollarSign, UserPlus, Check } from "lucide-react";
import { NavHeader } from "@/components/nav-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { getProfile } from "@/lib/profile";
import { ensureProfile } from "@/lib/auth";
import type { Notification } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";

const supabase = getSupabaseBrowserClient();

export default function NotificationsPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [currentUser, setCurrentUser] = useState<{
    username: string;
    role: "fan" | "creator";
    avatar?: string;
  } | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);

        // 强制使用 getSession() 获取当前用户
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          router.push("/auth");
          return;
        }

        await ensureProfile();

        // 加载用户信息
        const profile = await getProfile(session.user.id);
        if (profile) {
          setCurrentUser({
            username: profile.display_name || "user",
            role: (profile.role || "fan") as "fan" | "creator",
            avatar: profile.avatar_url || undefined,
          });
        }

        // 从数据库加载通知（使用当前用户的真实 ID）
        // 注意：如果 notifications 表不存在，这里会返回空数组
        const { data: notificationsData, error } = await supabase
          .from("notifications")
          .select("*")
          .eq("user_id", session.user.id)
          .order("created_at", { ascending: false })
          .limit(50);

        if (error) {
          console.error("[notifications] load error:", error);
          // 如果表不存在，使用空数组
          setNotifications([]);
        } else {
          setNotifications(
            (notificationsData || []).map((n: any) => ({
              id: n.id,
              user_id: n.user_id || "",
              type: (n.type || "new_post") as Notification["type"],
              title: n.title || "",
              message: n.message || "",
              link: n.link || undefined,
              actionUrl: n.action_url || n.link || undefined,
              read: n.read || false,
              created_at: n.created_at,
              createdAt: n.created_at, // 兼容字段
            }))
          );
        }
      } catch (err) {
        console.error("[notifications] loadData error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();

    // 监听通知变化
    const channel = supabase
      .channel("notifications-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
        },
        () => {
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  const filteredNotifications = notifications.filter((notif) => {
    if (filter === "unread") return !notif.read;
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "new_post":
        return <Bell className="w-5 h-5" />;
      case "like":
        return <Heart className="w-5 h-5" />;
      case "purchase":
        return <DollarSign className="w-5 h-5" />;
      case "new_subscriber":
        return <UserPlus className="w-5 h-5" />;
      default:
        return <Bell className="w-5 h-5" />;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    // 使用 date-fns 统一格式化时间
    return formatDistanceToNow(date, { addSuffix: true });
  };

  const markAsRead = async (notificationId: string) => {
    try {
      // 强制使用 getSession() 获取当前用户
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      // 更新数据库
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", notificationId)
        .eq("user_id", session.user.id);

      if (error) {
        console.error("[notifications] markAsRead error:", error);
      } else {
        // 更新本地状态
        setNotifications((prev) =>
          prev.map((notif) => (notif.id === notificationId ? { ...notif, read: true } : notif))
        );
      }
    } catch (err) {
      console.error("[notifications] markAsRead exception:", err);
    }
  };

  const markAllAsRead = async () => {
    try {
      // 强制使用 getSession() 获取当前用户
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      // 更新数据库
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", session.user.id)
        .eq("read", false);

      if (error) {
        console.error("[notifications] markAllAsRead error:", error);
      } else {
        // 更新本地状态
        setNotifications((prev) => prev.map((notif) => ({ ...notif, read: true })));
      }
    } catch (err) {
      console.error("[notifications] markAllAsRead exception:", err);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container max-w-2xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-muted rounded-3xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return null; // 正在重定向
  }

  return (
    <div className="min-h-screen bg-background">
      <NavHeader user={currentUser} notificationCount={unreadCount} />

      <main className="container max-w-2xl mx-auto px-4 md:px-8 py-8 md:py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Notifications</h1>
            <p className="text-muted-foreground">{unreadCount} unread</p>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={markAllAsRead}
              className="border-border bg-card hover:bg-card rounded-xl"
            >
              <Check className="w-4 h-4 mr-2" />
              Mark all read
            </Button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-8">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            onClick={() => setFilter("all")}
            className={`rounded-xl ${
              filter === "all" ? "bg-primary-gradient" : "border-border bg-card hover:bg-card"
            }`}
          >
            All
          </Button>
          <Button
            variant={filter === "unread" ? "default" : "outline"}
            onClick={() => setFilter("unread")}
            className={`rounded-xl ${
              filter === "unread" ? "bg-primary-gradient" : "border-border bg-card hover:bg-card"
            }`}
          >
            Unread ({unreadCount})
          </Button>
        </div>

        {/* Notifications List */}
        {filteredNotifications.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-card border border-border flex items-center justify-center">
              <Bell className="w-12 h-12 text-muted-foreground opacity-50" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">Inbox Empty</h3>
            <p className="text-muted-foreground">
              {filter === "unread"
                ? "You're all caught up!"
                : "You don't have any notifications yet"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`bg-card border border-border rounded-3xl p-4 md:p-6 cursor-pointer transition-all hover:bg-card ${
                  !notification.read ? "border-primary/30" : ""
                }`}
                onClick={async () => {
                  await markAsRead(notification.id);
                  if (notification.actionUrl) {
                    // 使用 router.push 而非 window.location.href，避免改变身份上下文
                    router.push(notification.actionUrl);
                  }
                }}
              >
                <div className="flex items-start gap-4">
                  {/* 未读通知左侧渐变小圆点 */}
                  {!notification.read && (
                    <div className="w-2 h-2 rounded-full bg-primary-gradient flex-shrink-0 mt-2"></div>
                  )}
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      !notification.read
                        ? "bg-primary/10 text-primary"
                        : "bg-border text-muted-foreground"
                    }`}
                  >
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm md:text-base ${!notification.read ? "font-semibold text-foreground" : "text-muted-foreground"}`}
                    >
                      {notification.message}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {formatDate(notification.createdAt || notification.created_at)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
