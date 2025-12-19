"use client"

import { useState } from "react"
import { Bell, Heart, DollarSign, UserPlus, Check } from "lucide-react"
import { NavHeader } from "@/components/nav-header"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/empty-state"
import type { Notification } from "@/lib/types"

// Mock data
const mockNotifications: Notification[] = [
  {
    id: "n1",
    type: "new_post",
    message: "sophia_creative posted new content",
    read: false,
    createdAt: "2024-01-15T10:30:00Z",
    actionUrl: "/post/123",
  },
  {
    id: "n2",
    type: "new_post",
    message: "alex_pro shared exclusive content for subscribers",
    read: false,
    createdAt: "2024-01-15T09:15:00Z",
    actionUrl: "/post/124",
  },
  {
    id: "n3",
    type: "new_post",
    message: "emma_artist uploaded a new post",
    read: true,
    createdAt: "2024-01-14T18:45:00Z",
    actionUrl: "/post/125",
  },
]

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState(mockNotifications)
  const [filter, setFilter] = useState<"all" | "unread">("all")

  const currentUser = {
    username: "john_doe",
    role: "fan" as const,
    avatar: "/placeholder.svg?height=100&width=100",
  }

  const filteredNotifications = notifications.filter((notif) => {
    if (filter === "unread") return !notif.read
    return true
  })

  const unreadCount = notifications.filter((n) => !n.read).length

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "new_post":
        return <Bell className="w-5 h-5" />
      case "like":
        return <Heart className="w-5 h-5" />
      case "purchase":
        return <DollarSign className="w-5 h-5" />
      case "new_subscriber":
        return <UserPlus className="w-5 h-5" />
      default:
        return <Bell className="w-5 h-5" />
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))

    if (hours < 1) return "Just now"
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  const markAsRead = (notificationId: string) => {
    setNotifications((prev) => prev.map((notif) => (notif.id === notificationId ? { ...notif, read: true } : notif)))
  }

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((notif) => ({ ...notif, read: true })))
  }

  return (
    <div className="min-h-screen bg-background">
      <NavHeader user={currentUser} notificationCount={unreadCount} />

      <main className="container max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Notifications</h1>
            <p className="text-muted-foreground">{unreadCount} unread</p>
          </div>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllAsRead} className="bg-transparent">
              <Check className="w-4 h-4 mr-2" />
              Mark all read
            </Button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            onClick={() => setFilter("all")}
            className={filter === "all" ? "" : "bg-transparent"}
          >
            All
          </Button>
          <Button
            variant={filter === "unread" ? "default" : "outline"}
            onClick={() => setFilter("unread")}
            className={filter === "unread" ? "" : "bg-transparent"}
          >
            Unread ({unreadCount})
          </Button>
        </div>

        {/* Notifications List */}
        {filteredNotifications.length === 0 ? (
          <EmptyState
            icon="bell"
            title="No notifications"
            description={filter === "unread" ? "You're all caught up!" : "You don't have any notifications yet"}
          />
        ) : (
          <div className="space-y-2">
            {filteredNotifications.map((notification) => (
              <Card
                key={notification.id}
                className={`p-4 cursor-pointer transition-colors hover:bg-accent/5 ${
                  !notification.read ? "bg-primary/5 border-primary/20" : ""
                }`}
                onClick={() => {
                  markAsRead(notification.id)
                  if (notification.actionUrl) {
                    window.location.href = notification.actionUrl
                  }
                }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${!notification.read ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
                  >
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm ${!notification.read ? "font-medium text-foreground" : "text-muted-foreground"}`}
                    >
                      {notification.message}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{formatDate(notification.createdAt)}</p>
                  </div>
                  {!notification.read && <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1" />}
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
