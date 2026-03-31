"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Heart,
  DollarSign,
  UserPlus,
  CheckCheck,
  Image,
  MessageCircle,
  AlertCircle,
  CreditCard,
  Clock,
} from "@/lib/icons";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { PageShell } from "@/components/page-shell";
import type { Notification } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";
import { useCountUp } from "@/hooks/use-count-up";
import { FilterTabBar } from "@/components/filter-tab-bar";
import { getAuthBootstrap } from "@/lib/auth-bootstrap-client";
import { useSkeletonMetric } from "@/hooks/use-skeleton-metric";

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
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  useSkeletonMetric("notifications_page", isLoading);

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);

        const bootstrap = await getAuthBootstrap();
        if (!bootstrap.authenticated || !bootstrap.user) {
          router.push("/auth");
          return;
        }
        const userId = bootstrap.user.id;
        setCurrentUserId(userId);
        setCurrentUser({
          username: bootstrap.profile?.display_name || bootstrap.user.email.split("@")[0] || "user",
          role: (bootstrap.profile?.role || "fan") as "fan" | "creator",
          avatar: bootstrap.profile?.avatar_url || undefined,
        });

        // 测试模式：设置好用户后立刻显示 Mock 通知（不等 DB 查询完成）
        if (process.env.NEXT_PUBLIC_TEST_MODE === "true") {
          setNotifications([
            {
              id: "mock-notif-1",
              user_id: userId,
              type: "new_post",
              title: "New post from Elena Rivers",
              message: "Elena Rivers just published exclusive content for subscribers.",
              read: false,
              created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
              createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
            },
            {
              id: "mock-notif-2",
              user_id: userId,
              type: "like",
              title: "Alex Martinez liked your post",
              message: "Alex Martinez liked your recent post.",
              read: false,
              created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
              createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            },
            {
              id: "mock-notif-3",
              user_id: userId,
              type: "new_subscriber",
              title: "New subscriber!",
              message: "You have a new subscriber on your creator page.",
              read: true,
              created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
              createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            },
            {
              id: "mock-notif-4",
              user_id: userId,
              type: "purchase",
              title: "Content unlocked",
              message: "Sophie Laurent unlocked your premium content.",
              read: true,
              created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
              createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
            },
          ] as Notification[]);
          setIsLoading(false);
          return;
        }

        // 从数据库加载通知（使用当前用户的真实 ID）
        // 注意：如果 notifications 表不存在，这里会返回空数组
        const { data: notificationsData, error } = await supabase
          .from("notifications")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(50);

        if (error) {
          console.error("[notifications] load error:", error);
          setNotifications([]);
        } else if (!notificationsData?.length && process.env.NEXT_PUBLIC_TEST_MODE === "true") {
          // 测试模式下无通知时，使用 Mock 数据展示通知样式
          setNotifications([
            {
              id: "mock-notif-1",
              user_id: userId,
              type: "new_post",
              title: "New post from Elena Rivers",
              message: "Elena Rivers just published exclusive content for subscribers.",
              read: false,
              created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
              createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
            },
            {
              id: "mock-notif-2",
              user_id: userId,
              type: "like",
              title: "Someone liked your post",
              message: "Alex Martinez liked your recent post.",
              read: false,
              created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
              createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            },
            {
              id: "mock-notif-3",
              user_id: userId,
              type: "new_subscriber",
              title: "New subscriber!",
              message: "You have a new subscriber on your creator page.",
              read: true,
              created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
              createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
            },
          ] as Notification[]);
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
  }, [router]);

  useEffect(() => {
    if (!currentUserId) return;
    const channel = supabase
      .channel(`notifications-changes-${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${currentUserId}`,
        },
        () => {
          // Re-fetch notifications when DB changes
          supabase
            .from("notifications")
            .select("*")
            .eq("user_id", currentUserId)
            .order("created_at", { ascending: false })
            .limit(50)
            .then(({ data }) => {
              if (data?.length) {
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
                }
                setNotifications(
                  data.map((n: NotificationData) => ({
                    id: n.id,
                    user_id: n.user_id || "",
                    type: (n.type || "new_post") as Notification["type"],
                    title: n.title || "",
                    message: n.message || "",
                    link: n.link || undefined,
                    actionUrl: n.action_url || n.link || undefined,
                    read: n.read || false,
                    created_at: n.created_at,
                    createdAt: n.created_at,
                  }))
                );
              }
            });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  const filteredNotifications = notifications.filter((notif) => {
    if (filter === "unread") return !notif.read;
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;
  const animatedUnreadCount = useCountUp(unreadCount, { duration: 700, decimals: 0 });

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "new_post":
        return <Image className="w-4 h-4 text-brand-primary" />;
      case "like":
        return <Heart className="w-4 h-4 text-error" />;
      case "comment":
        return <MessageCircle className="w-4 h-4 text-brand-secondary" />;
      case "purchase":
        return <DollarSign className="w-4 h-4 text-success" />;
      case "new_subscriber":
      case "subscriber":
        return <UserPlus className="w-4 h-4 text-success" />;
      case "subscription_expiring":
        return <AlertCircle className="w-4 h-4 text-warning" />;
      case "payment":
        return <CreditCard className="w-4 h-4 text-success" />;
      case "tip":
        return <DollarSign className="w-4 h-4 text-brand-accent" />;
      default:
        return <Bell className="w-4 h-4 text-text-tertiary" />;
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
        return "bg-white/8";
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
      if (!currentUserId) return;

      // 更新数据库
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", notificationId)
        .eq("user_id", currentUserId);

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
      if (!currentUserId) return;

      // 更新数据库
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", currentUserId)
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
      <PageShell user={currentUser} notificationCount={0} maxWidth="5xl">
        <div className="py-8 space-y-4">
          {/* Skeleton header */}
          <div className="flex items-center justify-between mb-4">
            <div className="space-y-2">
              <div className="h-8 w-40 bg-white/8 rounded-lg animate-pulse" />
              <div className="h-4 w-56 bg-white/8 rounded animate-pulse" />
            </div>
            <div className="h-10 w-32 bg-white/8 rounded-xl animate-pulse hidden md:block" />
          </div>
          {/* Filter skeleton */}
          <div className="flex gap-3 mb-6">
            <div className="h-10 w-24 bg-white/8 rounded-xl animate-pulse" />
            <div className="h-10 w-28 bg-white/8 rounded-xl animate-pulse" />
          </div>
          {/* Items skeleton */}
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card-block p-3 flex gap-3 animate-pulse">
              <div className="w-10 h-10 rounded-xl bg-surface-raised flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-32 bg-white/8 rounded" />
                <div className="h-3 w-full bg-white/8 rounded" />
                <div className="h-3 w-20 bg-white/8 rounded" />
              </div>
            </div>
          ))}
        </div>
      </PageShell>
    );
  }

  if (!currentUser) {
    return null;
  }

  return (
    <PageShell user={currentUser} notificationCount={unreadCount} maxWidth="5xl">
      <div className="py-8" data-testid="notifications-list">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-text-primary mb-1">Notifications</h1>
            {unreadCount > 0 && (
              <p className="text-text-tertiary flex items-center gap-2 text-sm">
                <span className="w-2 h-2 bg-brand-primary rounded-full animate-pulse" />
                {animatedUnreadCount.toFixed(0)} unread
              </p>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="px-5 py-2.5 text-brand-primary hover:bg-brand-primary-alpha-10 rounded-xl font-semibold transition-all active:scale-95 focus-visible:outline-2 focus-visible:outline-brand-primary flex items-center gap-2 text-sm"
            >
              <CheckCheck className="w-4 h-4" />
              <span className="hidden sm:inline">Mark all read</span>
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <FilterTabBar
          active={filter}
          onChange={(id) => setFilter(id as "all" | "unread")}
          items={[
            { id: "all", label: "All" },
            { id: "unread", label: "Unread", count: unreadCount > 0 ? unreadCount : undefined },
          ]}
        />

        {/* Two-column layout on Desktop */}
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Notifications List — w-0 prevents intrinsic content width from affecting flex calculation */}
          <div className="flex-1 min-w-0 lg:w-0">
            {filteredNotifications.length === 0 ? (
              <div className="text-center py-20 card-block">
                <div className="w-24 h-24 bg-white/8 rounded-3xl flex items-center justify-center mx-auto mb-6">
                  <Bell className="w-10 h-10 text-text-quaternary" />
                </div>
                <h3 className="text-xl font-bold mb-2 text-text-primary">
                  {filter === "unread" ? "All caught up!" : "No notifications yet"}
                </h3>
                <p className="text-text-tertiary">
                  {filter === "unread"
                    ? "You've read all your notifications"
                    : "We'll notify you when something happens"}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedNotifications).map(([dateGroup, groupNotifications]) => (
                  <div key={dateGroup}>
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="font-bold text-text-secondary text-sm">{dateGroup}</h3>
                      <div className="flex-1 h-px bg-border-subtle" />
                    </div>
                    <div className="space-y-2">
                      {groupNotifications.map((notification) => {
                        const notificationDate = notification.createdAt || notification.created_at;
                        return (
                          <div
                            key={notification.id}
                            className={`group card-block overflow-hidden cursor-pointer hover-bold transition-all active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-brand-primary ${
                              !notification.read ? "ring-2 ring-brand-primary/20" : ""
                            }`}
                            role="button"
                            tabIndex={0}
                            onKeyDown={async (e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                await markAsRead(notification.id);
                                if (notification.actionUrl) router.push(notification.actionUrl);
                              }
                            }}
                            onClick={async () => {
                              await markAsRead(notification.id);
                              if (notification.actionUrl) router.push(notification.actionUrl);
                            }}
                          >
                            <div className="p-2.5 md:p-3 flex gap-3">
                              <div
                                className={`w-8 h-8 ${getNotificationBgColor(notification.type)} rounded-lg flex items-center justify-center border border-border-base flex-shrink-0`}
                              >
                                {getNotificationIcon(notification.type)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-3 mb-0.5">
                                  <h4 className="font-bold text-text-primary text-sm">
                                    {notification.title || notification.message}
                                  </h4>
                                  {!notification.read && (
                                    <div className="w-2.5 h-2.5 bg-brand-primary rounded-full animate-pulse flex-shrink-0 mt-1" />
                                  )}
                                </div>
                                <p className="text-text-secondary text-xs mb-1.5 line-clamp-2">
                                  {notification.message}
                                </p>
                                <p className="text-text-tertiary text-xs flex items-center gap-1.5">
                                  <Clock className="w-3 h-3" />
                                  {notificationDate ? formatDate(notificationDate) : "Unknown date"}
                                </p>
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

          {/* Desktop Sidebar: Summary Panel */}
          <aside className="hidden lg:block w-72 shrink-0">
            <div className="sticky top-24 space-y-4">
              <div className="card-block p-5">
                <h3 className="text-sm font-semibold text-text-primary mb-4">Summary</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between text-text-secondary">
                    <span>Total</span>
                    <span className="font-semibold text-text-primary">{notifications.length}</span>
                  </div>
                  <div className="flex items-center justify-between text-text-secondary">
                    <span>Unread</span>
                    <span className="font-semibold text-brand-primary">{unreadCount}</span>
                  </div>
                  <div className="flex items-center justify-between text-text-secondary">
                    <span>Read</span>
                    <span className="font-semibold text-success">
                      {notifications.length - unreadCount}
                    </span>
                  </div>
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="mt-4 w-full py-2 px-4 bg-brand-primary-alpha-10 text-brand-primary rounded-xl font-semibold text-sm transition-all hover:bg-brand-primary/20 active:scale-95 focus-visible:outline-2 focus-visible:outline-brand-primary flex items-center justify-center gap-2"
                  >
                    <CheckCheck className="w-4 h-4" />
                    Mark All Read
                  </button>
                )}
              </div>

              {/* Notification categories legend */}
              <div className="card-block p-5">
                <h3 className="text-sm font-semibold text-text-primary mb-3">Categories</h3>
                <div className="space-y-2 text-xs text-text-tertiary">
                  {[
                    { label: "New Posts", color: "bg-brand-primary-alpha-10" },
                    { label: "Likes", color: "bg-error/10" },
                    { label: "Comments", color: "bg-brand-secondary/10" },
                    { label: "Purchases", color: "bg-success/10" },
                    { label: "Subscribers", color: "bg-success/10" },
                  ].map((cat) => (
                    <div key={cat.label} className="flex items-center gap-2">
                      <span className={`w-4 h-4 rounded-lg ${cat.color} flex-shrink-0`} />
                      {cat.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </PageShell>
  );
}
