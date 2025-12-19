"use client"

import { Heart, ShoppingBag, Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

interface EmptyStateProps {
  icon: "heart" | "shopping-bag" | "bell" | string
  title: string
  description: string
  action?: {
    label: string
    href?: string
    onClick?: () => void
  }
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  const getIcon = () => {
    switch (icon) {
      case "heart":
        return <Heart className="w-10 h-10 text-muted-foreground" />
      case "shopping-bag":
        return <ShoppingBag className="w-10 h-10 text-muted-foreground" />
      case "bell":
        return <Bell className="w-10 h-10 text-muted-foreground" />
      default:
        return <Heart className="w-10 h-10 text-muted-foreground" />
    }
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-20 h-20 rounded-full bg-card border-2 border-border flex items-center justify-center mb-6">
        {getIcon()}
      </div>
      <h3 className="text-xl font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-muted-foreground max-w-sm mb-6">{description}</p>
      {action && (
        <>
          {action.href ? (
            <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <Link href={action.href}>{action.label}</Link>
            </Button>
          ) : (
            <Button onClick={action.onClick} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              {action.label}
            </Button>
          )}
        </>
      )}
    </div>
  )
}
