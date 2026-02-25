"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Heart,
  DollarSign,
  UserPlus,
  Check,
  CheckCheck,
  Image,
  MessageCircle,
  AlertCircle,
  CreditCard,
  Clock,
  Trash2,
} from "lucide-react";
import { NavHeader } from "@/components/nav-header";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { BottomNavigation } from "@/components/bottom-navigation";
import { LoadingState } from "@/components/loading-state";
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
          interface NotificationData {
            id: string;
            user_id?: string;
            type?: string;
            title?: string;
            message?: string;
            link?: string;
            action_url?: string;
            read?: boolean;
            created_at?: string;
            createdAt?: string;
          }
          setNotifications(
            (notificationsData || []).map((n: NotificationData) => ({
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
        return <Image className="w-5 h-5 text-brand-primary" />;
      case "like":
        return <Heart className="w-5 h-5 text-error" />;
      case "comment":
        return <MessageCircle className="w-5 h-5 text-brand-secondary" />;
      case "purchase":
        return <DollarSign className="w-5 h-5 text-success" />;
      case "new_subscriber":
      case "subscriber":
        return <UserPlus className="w-5 h-5 text-success" />;
      case "subscription_expiring":
        return <AlertCircle className="w-5 h-5 text-warning" />;
      case "payment":
        return <CreditCard className="w-5 h-5 text-success" />;
      case "tip":
        return <DollarSign className="w-5 h-5 text-brand-accent" />;
      default:
        return <Bell className="w-5 h-5 text-text-tertiary" />;
    }
  };

  const getNotificationBgColor = (type: string) => {
    switch (type) {
      case "new_post":
        return "bg-brand-primary-alpha-10";
      case "like":
        return "bg-error/10";
      case "comment":
        return "bg-brand-secondary/10";
      case "purchase":
        return "bg-success/10";
      case "new_subscriber":
      case "subscriber":
        return "bg-success/10";
      case "subscription_expiring":
        return "bg-warning/10";
      case "payment":
        return "bg-success/10";
      case "tip":
        return "bg-brand-accent/10";
      default:
        return "bg-surface-raised";
    }
  };

  // Group notifications by date
  const groupedNotifications = filteredNotifications.reduce(
    (groups: { [key: string]: typeof filteredNotifications }, notification) => {
      const date = notification.created_at ? new Date(notification.created_at) : new Date();
      const now = new Date();
      const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

      let dateGroup: string;
      if (diffHours < 24) {
        dateGroup = "Today";
      } else if (diffHours < 48) {
        dateGroup = "Yesterday";
      } else {
        dateGroup = "Earlier";
      }

      if (!groups[dateGroup]) {
        groups[dateGroup] = [];
      }
      groups[dateGroup].push(notification);
      return groups;
    },
    {}
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
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
      <div className="min-h-screen bg-background pb-24 md:pb-0">
        <NavHeader user={currentUser ?? undefined} notificationCount={0} />
        <div className="pt-20 md:pt-24 max-w-4xl mx-auto px-4 md:px-6 py-8">
          <LoadingState type="skeleton" />
        </div>
        <BottomNavigation notificationCount={0} />
      </div>
    );
  }

  if (!currentUser) {
    return null; // 正在重定向
  }

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-0">
      <NavHeader user={currentUser ?? undefined} notificationCount={unreadCount} />

      <div className="pt-20 md:pt-24">
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-8">
          {/* Header - Figma Style */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-text-primary mb-2">Notifications</h1>
              {unreadCount > 0 && (
                <p className="text-text-tertiary flex items-center gap-2">
                  <span className="w-2 h-2 bg-brand-primary rounded-full animate-pulse" />
                  {unreadCount} unread notification{unreadCount !== 1 ? "s" : ""}
                </p>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="px-5 py-2.5 text-brand-primary hover:bg-brand-primary-alpha-10 rounded-xl font-semibold transition-all active:scale-95 flex items-center gap-2"
              >
                <CheckCheck className="w-4 h-4" />
                Mark all read
              </button>
            )}
          </div>

          {/* Filter Tabs - Figma Style */}
          <div className="flex gap-3 mb-6">
            <button
              onClick={() => setFilter("all")}
              className={`flex-1 py-3 rounded-xl font-semibold transition-all active:scale-[0.98] ${
                filter === "all"
                  ? "bg-brand-primary text-white shadow-glow"
                  : "bg-surface-raised text-text-secondary hover:bg-surface-overlay border border-border-base"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter("unread")}
              className={`flex-1 py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 active:scale-[0.98] ${
                filter === "unread"
                  ? "bg-brand-primary text-white shadow-glow"
                  : "bg-surface-raised text-text-secondary hover:bg-surface-overlay border border-border-base"
              }`}
            >
              Unread
              {unreadCount > 0 && (
                <span
                  className={`px-2.5 py-0.5 ${filter === "unread" ? "bg-white/20" : "bg-brand-primary-alpha-10 text-brand-primary"} rounded-full text-xs font-bold`}
                >
                  {unreadCount}
                </span>
              )}
            </button>
          </div>

          {/* Notifications List - Figma Style */}
          {filteredNotifications.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-24 h-24 bg-surface-raised rounded-3xl flex items-center justify-center mx-auto mb-6">
                <Bell className="w-10 h-10 text-text-quaternary" />
              </div>
              <h3 className="text-2xl font-bold mb-2 text-text-primary">
                {filter === "unread" ? "All caught up!" : "No notifications yet"}
              </h3>
              <p className="text-text-tertiary text-lg">
                {filter === "unread"
                  ? "You've read all your notifications"
                  : "We'll notify you when something happens"}
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {Object.entries(groupedNotifications).map(([dateGroup, groupNotifications]) => (
                <div key={dateGroup}>
                  {/* Date Header */}
                  <div className="flex items-center gap-3 mb-4">
                    <h3 className="font-bold text-text-secondary">{dateGroup}</h3>
                    <div className="flex-1 h-px bg-border-subtle" />
                  </div>

                  {/* Notifications in this group */}
                  <div className="space-y-3">
                    {groupNotifications.map((notification) => {
                      const notificationDate = notification.createdAt || notification.created_at;
                      return (
                        <div
                          key={notification.id}
                          className={`group bg-surface-raised border border-border-base rounded-2xl overflow-hidden hover:border-brand-primary/30 transition-all cursor-pointer ${
                            !notification.read ? "ring-2 ring-brand-primary/20" : ""
                          }`}
                          onClick={async () => {
                            await markAsRead(notification.id);
                            if (notification.actionUrl) {
                              router.push(notification.actionUrl);
                            }
                          }}
                        >
                          <div className="p-5">
                            <div className="flex gap-4">
                              {/* Icon */}
                              <div
                                className={`w-14 h-14 ${getNotificationBgColor(notification.type)} rounded-2xl flex items-center justify-center border border-border-base flex-shrink-0`}
                              >
                                {getNotificationIcon(notification.type)}
                              </div>

                              {/* Content */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-3 mb-1">
                                  <h4 className="font-bold text-text-primary">
                                    {notification.title || notification.message}
                                  </h4>
                                  <div className="flex items-center gap-2">
                                    {!notification.read && (
                                      <div className="w-2.5 h-2.5 bg-brand-primary rounded-full animate-pulse" />
                                    )}
                                  </div>
                                </div>
                                <p className="text-text-secondary text-sm mb-2">
                                  {notification.message}
                                </p>
                                <p className="text-text-tertiary text-xs flex items-center gap-1.5">
                                  <Clock className="w-3 h-3" />
                                  {notificationDate ? formatDate(notificationDate) : "Unknown date"}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <BottomNavigation notificationCount={unreadCount} userRole={currentUser?.role} />
    </div>
  );
}
