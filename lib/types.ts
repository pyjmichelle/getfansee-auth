export type UserRole = "fan" | "creator"

export type KYCStatus = "not_started" | "pending" | "approved" | "failed"

export interface User {
  id: string
  username: string
  email: string
  role: UserRole
  kycStatus?: KYCStatus
  avatar?: string
  bio?: string
  subscriptionPrice?: number
  isVerified?: boolean
}

export interface Post {
  id: string
  creatorId: string
  creator: User
  type: "free" | "subscribers" | "ppv"
  price?: number
  content: string
  mediaUrl?: string
  createdAt: string
  likes: number
  isLiked?: boolean
  isUnlocked?: boolean
}

export interface Subscription {
  id: string
  creatorId: string
  creator: User
  status: "active" | "expired"
  startDate: string
  endDate: string
  price: number
}

export interface Purchase {
  id: string
  postId: string
  post: Post
  price: number
  purchaseDate: string
}

export interface Notification {
  id: string
  type: "new_post" | "new_subscriber" | "like" | "purchase"
  message: string
  read: boolean
  createdAt: string
  actionUrl?: string
}
