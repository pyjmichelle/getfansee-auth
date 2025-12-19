"use client"

import { useState } from "react"
import { ArrowLeft, DollarSign, TrendingUp, Calendar, Download } from "lucide-react"
import { NavHeader } from "@/components/nav-header"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"

interface Transaction {
  id: string
  type: "subscription" | "ppv" | "tip"
  amount: number
  date: string
  description: string
  status: "completed" | "pending"
}

const mockTransactions: Transaction[] = [
  {
    id: "1",
    type: "subscription",
    amount: 9.99,
    date: "2024-01-15T10:30:00Z",
    description: "Monthly subscription from john_doe",
    status: "completed",
  },
  {
    id: "2",
    type: "ppv",
    amount: 25.0,
    date: "2024-01-14T14:20:00Z",
    description: "PPV unlock from jane_smith",
    status: "completed",
  },
  {
    id: "3",
    type: "subscription",
    amount: 9.99,
    date: "2024-01-14T09:15:00Z",
    description: "Monthly subscription from mike_wilson",
    status: "completed",
  },
  {
    id: "4",
    type: "ppv",
    amount: 15.0,
    date: "2024-01-13T16:45:00Z",
    description: "PPV unlock from sarah_jones",
    status: "pending",
  },
]

export default function EarningsPage() {
  const [transactions] = useState(mockTransactions)
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d" | "all">("30d")

  const currentUser = {
    username: "sophia_creative",
    role: "creator" as const,
    avatar: "/placeholder.svg?height=100&width=100",
  }

  const totalEarnings = transactions.filter((t) => t.status === "completed").reduce((sum, t) => sum + t.amount, 0)

  const pendingEarnings = transactions.filter((t) => t.status === "pending").reduce((sum, t) => sum + t.amount, 0)

  const platformFee = totalEarnings * 0.2
  const yourCut = totalEarnings * 0.8

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "subscription":
        return "Subscription"
      case "ppv":
        return "Pay Per View"
      case "tip":
        return "Tip"
      default:
        return type
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

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Earnings</h1>
            <p className="text-muted-foreground">Track your revenue and payouts</p>
          </div>
          <Button variant="outline" className="bg-transparent">
            <Download className="w-4 h-4 mr-2" />
            Export
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
          <Button
            variant={timeRange === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setTimeRange("all")}
            className={timeRange === "all" ? "" : "bg-transparent"}
          >
            All Time
          </Button>
        </div>

        {/* Earnings Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 text-green-500 flex items-center justify-center">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">${totalEarnings.toFixed(2)}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Total Earnings</p>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">${yourCut.toFixed(2)}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Your Cut (80%)</p>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-yellow-500/10 text-yellow-500 flex items-center justify-center">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">${pendingEarnings.toFixed(2)}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Pending</p>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-muted text-muted-foreground flex items-center justify-center">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">${platformFee.toFixed(2)}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Platform Fee (20%)</p>
          </Card>
        </div>

        {/* Next Payout */}
        <Card className="p-6 mb-8 bg-primary/5 border-primary/20">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-foreground mb-1">Next Payout</h3>
              <p className="text-sm text-muted-foreground">Scheduled for February 1, 2024</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-foreground">${yourCut.toFixed(2)}</p>
              <p className="text-sm text-muted-foreground">Available balance</p>
            </div>
          </div>
        </Card>

        {/* Transaction History */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Transaction History</h2>
          <div className="space-y-3">
            {transactions.map((transaction) => (
              <div key={transaction.id} className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    transaction.status === "completed"
                      ? "bg-green-500/10 text-green-500"
                      : "bg-yellow-500/10 text-yellow-500"
                  }`}
                >
                  <DollarSign className="w-5 h-5" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-foreground">{transaction.description}</p>
                    <Badge variant={transaction.status === "completed" ? "default" : "secondary"} className="text-xs">
                      {transaction.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span>{getTypeLabel(transaction.type)}</span>
                    <span>•</span>
                    <span>{formatDate(transaction.date)}</span>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-lg font-bold text-foreground">+${transaction.amount.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">${(transaction.amount * 0.8).toFixed(2)} after fee</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </main>
    </div>
  )
}
