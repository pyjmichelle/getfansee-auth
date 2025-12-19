"use client"

import { useState } from "react"
import { ArrowLeft, Search, Calendar, DollarSign, MoreVertical } from "lucide-react"
import { NavHeader } from "@/components/nav-header"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import Link from "next/link"

interface Subscriber {
  id: string
  username: string
  avatar: string
  joinDate: string
  renewDate: string
  status: "active" | "expiring" | "cancelled"
  totalSpent: number
}

const mockSubscribers: Subscriber[] = [
  {
    id: "1",
    username: "john_doe",
    avatar: "/placeholder.svg?height=100&width=100",
    joinDate: "2024-01-01",
    renewDate: "2024-02-01",
    status: "active",
    totalSpent: 29.97,
  },
  {
    id: "2",
    username: "jane_smith",
    avatar: "/placeholder.svg?height=100&width=100",
    joinDate: "2023-12-15",
    renewDate: "2024-01-20",
    status: "expiring",
    totalSpent: 89.91,
  },
  {
    id: "3",
    username: "mike_wilson",
    avatar: "/placeholder.svg?height=100&width=100",
    joinDate: "2023-11-20",
    renewDate: "2024-01-18",
    status: "cancelled",
    totalSpent: 159.84,
  },
]

export default function SubscribersPage() {
  const [subscribers] = useState(mockSubscribers)
  const [searchQuery, setSearchQuery] = useState("")
  const [filter, setFilter] = useState<"all" | "active" | "expiring" | "cancelled">("all")

  const currentUser = {
    username: "sophia_creative",
    role: "creator" as const,
    avatar: "/placeholder.svg?height=100&width=100",
  }

  const filteredSubscribers = subscribers.filter((sub) => {
    const matchesSearch = sub.username.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesFilter = filter === "all" || sub.status === filter
    return matchesSearch && matchesFilter
  })

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/20">Active</Badge>
      case "expiring":
        return <Badge className="bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20">Expiring Soon</Badge>
      case "cancelled":
        return <Badge variant="secondary">Cancelled</Badge>
      default:
        return null
    }
  }

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
          <h1 className="text-3xl font-bold text-foreground mb-2">Subscribers</h1>
          <p className="text-muted-foreground">Manage your subscriber base</p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Card className="p-6">
            <p className="text-sm text-muted-foreground mb-1">Total Subscribers</p>
            <p className="text-3xl font-bold text-foreground">342</p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-muted-foreground mb-1">Monthly Revenue</p>
            <p className="text-3xl font-bold text-foreground">$3,418</p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-muted-foreground mb-1">Expiring Soon</p>
            <p className="text-3xl font-bold text-yellow-500">12</p>
          </Card>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search subscribers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-11"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
            <Button
              variant={filter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("all")}
              className={filter === "all" ? "" : "bg-transparent"}
            >
              All
            </Button>
            <Button
              variant={filter === "active" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("active")}
              className={filter === "active" ? "" : "bg-transparent"}
            >
              Active
            </Button>
            <Button
              variant={filter === "expiring" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("expiring")}
              className={filter === "expiring" ? "" : "bg-transparent"}
            >
              Expiring
            </Button>
            <Button
              variant={filter === "cancelled" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("cancelled")}
              className={filter === "cancelled" ? "" : "bg-transparent"}
            >
              Cancelled
            </Button>
          </div>
        </div>

        {/* Subscribers List */}
        <div className="space-y-3">
          {filteredSubscribers.map((subscriber) => (
            <Card key={subscriber.id} className="p-4">
              <div className="flex items-center gap-4">
                <Avatar className="w-12 h-12">
                  <AvatarImage src={subscriber.avatar || "/placeholder.svg"} />
                  <AvatarFallback>{subscriber.username[0].toUpperCase()}</AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-foreground">{subscriber.username}</p>
                    {getStatusBadge(subscriber.status)}
                  </div>
                  <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      Joined {formatDate(subscriber.joinDate)}
                    </span>
                    <span className="flex items-center gap-1">
                      <DollarSign className="w-4 h-4" />${subscriber.totalSpent} total
                    </span>
                  </div>
                </div>

                <div className="hidden sm:flex flex-col items-end gap-1">
                  <p className="text-sm text-muted-foreground">
                    {subscriber.status === "cancelled" ? "Cancelled" : `Renews ${formatDate(subscriber.renewDate)}`}
                  </p>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>View Profile</DropdownMenuItem>
                    <DropdownMenuItem>Send Message</DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive">Block User</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </Card>
          ))}
        </div>
      </main>
    </div>
  )
}
