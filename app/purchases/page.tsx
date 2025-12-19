"use client"

import { useState } from "react"
import { DollarSign, Calendar } from "lucide-react"
import { NavHeader } from "@/components/nav-header"
import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/empty-state"
import type { Purchase } from "@/lib/types"
import Link from "next/link"

// Mock data
const mockPurchases: Purchase[] = [
  {
    id: "p1",
    postId: "post1",
    post: {
      id: "post1",
      creatorId: "c3",
      creator: {
        id: "c3",
        username: "emma_artist",
        email: "emma@example.com",
        role: "creator",
        avatar: "/placeholder.svg?height=100&width=100",
        isVerified: false,
      },
      type: "ppv",
      price: 25,
      content: "Premium exclusive content",
      mediaUrl: "/placeholder.svg?height=400&width=600",
      createdAt: "2024-01-10T14:30:00Z",
      likes: 89,
      isUnlocked: true,
    },
    price: 25,
    purchaseDate: "2024-01-10T14:35:00Z",
  },
  {
    id: "p2",
    postId: "post2",
    post: {
      id: "post2",
      creatorId: "c1",
      creator: {
        id: "c1",
        username: "sophia_creative",
        email: "sophia@example.com",
        role: "creator",
        avatar: "/placeholder.svg?height=100&width=100",
        isVerified: true,
      },
      type: "ppv",
      price: 15,
      content: "Special behind the scenes footage",
      mediaUrl: "/placeholder.svg?height=400&width=600",
      createdAt: "2024-01-08T10:15:00Z",
      likes: 156,
      isUnlocked: true,
    },
    price: 15,
    purchaseDate: "2024-01-08T10:20:00Z",
  },
]

export default function PurchasesPage() {
  const [purchases] = useState(mockPurchases)

  const currentUser = {
    username: "john_doe",
    role: "fan" as const,
    avatar: "/placeholder.svg?height=100&width=100",
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  const totalSpent = purchases.reduce((sum, purchase) => sum + purchase.price, 0)

  return (
    <div className="min-h-screen bg-background">
      <NavHeader user={currentUser} notificationCount={3} />

      <main className="container max-w-4xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">Your Purchases</h1>
          <p className="text-muted-foreground">View all your unlocked content</p>
        </div>

        {/* Stats */}
        {purchases.length > 0 && (
          <Card className="p-6 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Purchases</p>
                <p className="text-2xl font-bold text-foreground">{purchases.length}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Spent</p>
                <p className="text-2xl font-bold text-foreground">${totalSpent.toFixed(2)}</p>
              </div>
            </div>
          </Card>
        )}

        {/* Purchases List */}
        {purchases.length === 0 ? (
          <EmptyState
            icon="shopping-bag"
            title="No purchases yet"
            description="Unlock premium content from your favorite creators"
            action={{ label: "Browse Content", href: "/home" }}
          />
        ) : (
          <div className="space-y-4">
            {purchases.map((purchase) => (
              <Card key={purchase.id} className="overflow-hidden">
                <div className="flex flex-col md:flex-row">
                  {/* Media Preview */}
                  <Link
                    href={`/post/${purchase.post.id}`}
                    className="relative bg-muted md:w-64 aspect-video md:aspect-auto"
                  >
                    <img
                      src={purchase.post.mediaUrl || "/placeholder.svg"}
                      alt="Purchase preview"
                      className="w-full h-full object-cover"
                    />
                  </Link>

                  {/* Purchase Details */}
                  <div className="flex-1 p-6">
                    <div className="flex items-start justify-between mb-3">
                      <Link href={`/creator/${purchase.post.creator.username}`} className="flex items-center gap-3">
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={purchase.post.creator.avatar || "/placeholder.svg"} />
                          <AvatarFallback>{purchase.post.creator.username[0].toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground">{purchase.post.creator.username}</span>
                            {purchase.post.creator.isVerified && (
                              <svg className="w-4 h-4 text-primary" fill="currentColor" viewBox="0 0 20 20">
                                <path
                                  fillRule="evenodd"
                                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">Creator</p>
                        </div>
                      </Link>
                    </div>

                    <p className="text-foreground mb-4 line-clamp-2">{purchase.post.content}</p>

                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-4">
                      <div className="flex items-center gap-1">
                        <DollarSign className="w-4 h-4" />${purchase.price}
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        Purchased {formatDate(purchase.purchaseDate)}
                      </div>
                    </div>

                    <Button asChild variant="outline" className="bg-transparent">
                      <Link href={`/post/${purchase.post.id}`}>View Content</Link>
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
