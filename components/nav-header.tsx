"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Bell,
  Search,
  Menu,
  Home,
  Heart,
  CreditCard,
  User,
  LayoutDashboard,
  FileText,
  DollarSign,
  Eye,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { useState } from "react"

interface NavHeaderProps {
  user?: {
    username: string
    role: "fan" | "creator"
    avatar?: string
    creatorStatus?: "pending" | "approved"
  }
  notificationCount?: number
}

export function NavHeader({ user, notificationCount = 0 }: NavHeaderProps) {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  const isCreator = user?.role === "creator"
  const showBecomeCreator = user && !isCreator

  const [currentView, setCurrentView] = useState<"fan" | "creator">(user?.role || "fan")

  const handleRoleSwitch = () => {
    setCurrentView(currentView === "fan" ? "creator" : "fan")
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="container flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/home" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">G</span>
            </div>
            <span className="font-bold text-xl hidden md:inline">GetFanSee</span>
          </Link>
        </div>

        <div className="hidden md:flex flex-1 max-w-md mx-6">
          {!searchOpen ? (
            <Button
              variant="outline"
              className="w-full justify-start text-muted-foreground bg-background"
              onClick={() => setSearchOpen(true)}
            >
              <Search className="w-4 h-4 mr-2" />
              Search creators...
            </Button>
          ) : (
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search creators..."
                className="w-full h-10 pl-9 pr-4 rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onBlur={() => {
                  if (!searchQuery) setSearchOpen(false)
                }}
                autoFocus
              />
              {searchQuery && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-md shadow-lg p-4">
                  <p className="text-sm text-muted-foreground">No results found for "{searchQuery}"</p>
                  <p className="text-xs text-muted-foreground mt-2">Try searching for creator usernames</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {showBecomeCreator && (
            <Button asChild className="hidden md:flex bg-accent hover:bg-accent/90 text-accent-foreground">
              <Link href="/creator/upgrade">
                <Sparkles className="w-4 h-4 mr-2" />
                Become a Creator
              </Link>
            </Button>
          )}

          {user && (
            <>
              <Button variant="ghost" size="icon" className="relative" asChild>
                <Link href="/notifications">
                  <Bell className="w-5 h-5" />
                  {notificationCount > 0 && (
                    <Badge className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center p-0 text-xs">
                      {notificationCount}
                    </Badge>
                  )}
                </Link>
              </Button>

              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2 px-3">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={user.avatar || "/placeholder.svg"} />
                      <AvatarFallback className="text-sm">
                        {user.username[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden md:inline font-medium text-sm">{user.username}</span>
                    <Menu className="w-4 h-4 md:hidden" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-80">
                  <div className="mb-6 pt-4">
                    <div className="flex items-center gap-3 mb-4">
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={user.avatar || "/placeholder.svg"} />
                        <AvatarFallback>{user.username[0].toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-semibold text-foreground">{user.username}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="text-xs">
                            {isCreator ? "Creator" : "Fan"}
                          </Badge>
                          {isCreator && user.creatorStatus === "pending" && (
                            <Badge variant="secondary" className="text-xs bg-yellow-500/10 text-yellow-500">
                              Pending
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    {isCreator && (
                      <>
                        <div className="flex items-center gap-2 mb-4">
                          <Button
                            variant={currentView === "fan" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentView("fan")}
                            className={currentView === "fan" ? "" : "bg-transparent flex-1"}
                          >
                            Fan
                          </Button>
                          <Button
                            variant={currentView === "creator" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentView("creator")}
                            className={currentView === "creator" ? "" : "bg-transparent flex-1"}
                          >
                            Creator
                          </Button>
                        </div>
                        <Separator className="mb-4" />
                      </>
                    )}
                  </div>

                  <nav className="flex flex-col gap-2">
                    {(!isCreator || currentView === "fan") && (
                      <>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          Discover
                        </p>
                        <Button
                          variant={pathname === "/home" ? "secondary" : "ghost"}
                          className="justify-start"
                          asChild
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <Link href="/home">
                            <Home className="w-4 h-4 mr-3" />
                            Feed
                          </Link>
                        </Button>
                        <Separator className="my-2" />

                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          Your Content
                        </p>
                        <Button
                          variant={pathname === "/subscriptions" ? "secondary" : "ghost"}
                          className="justify-start"
                          asChild
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <Link href="/subscriptions">
                            <Heart className="w-4 h-4 mr-3" />
                            Subscriptions
                          </Link>
                        </Button>
                        <Button
                          variant={pathname === "/purchases" ? "secondary" : "ghost"}
                          className="justify-start"
                          asChild
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <Link href="/purchases">
                            <CreditCard className="w-4 h-4 mr-3" />
                            Purchases
                          </Link>
                        </Button>
                        <Separator className="my-2" />
                      </>
                    )}

                    {isCreator && currentView === "creator" && (
                      <>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          Creator Studio
                        </p>
                        <Button
                          variant={pathname === "/creator/studio" ? "secondary" : "ghost"}
                          className="justify-start"
                          asChild
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <Link href="/creator/studio">
                            <LayoutDashboard className="w-4 h-4 mr-3" />
                            Dashboard
                          </Link>
                        </Button>
                        <Button
                          variant={pathname?.startsWith("/creator/studio/post") ? "secondary" : "ghost"}
                          className="justify-start"
                          asChild
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <Link href="/creator/studio/post/new">
                            <FileText className="w-4 h-4 mr-3" />
                            My Posts
                          </Link>
                        </Button>
                        <Button
                          variant={pathname === "/creator/studio/earnings" ? "secondary" : "ghost"}
                          className="justify-start"
                          asChild
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <Link href="/creator/studio/earnings">
                            <DollarSign className="w-4 h-4 mr-3" />
                            Earnings
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          className="justify-start"
                          asChild
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <Link href={`/creator/${user.username}?viewAs=fan`}>
                            <Eye className="w-4 h-4 mr-3" />
                            View as Fan
                          </Link>
                        </Button>
                        <Separator className="my-2" />
                      </>
                    )}

                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Account</p>
                    <Button
                      variant={pathname === "/me" ? "secondary" : "ghost"}
                      className="justify-start"
                      asChild
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Link href="/me">
                        <User className="w-4 h-4 mr-3" />
                        Profile
                      </Link>
                    </Button>

                    {showBecomeCreator && (
                      <>
                        <Separator className="my-2" />
                        <Button
                          variant="default"
                          className="justify-start bg-accent hover:bg-accent/90 text-accent-foreground"
                          asChild
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <Link href="/creator/upgrade">
                            <Sparkles className="w-4 h-4 mr-3" />
                            Become a Creator
                          </Link>
                        </Button>
                      </>
                    )}
                  </nav>
                </SheetContent>
              </Sheet>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
