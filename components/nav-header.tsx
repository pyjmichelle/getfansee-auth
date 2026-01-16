"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth";
import { WalletBalancePreview } from "@/components/wallet-balance-preview";

interface NavHeaderProps {
  user?: {
    username: string;
    role: "fan" | "creator";
    avatar?: string;
    creatorStatus?: "pending" | "approved";
  };
  notificationCount?: number;
}

export function NavHeader({ user, notificationCount = 0 }: NavHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const isCreator = user?.role === "creator";
  // 常驻转化入口：仅在用户尚未通过创作者认证时显示
  const showBecomeCreator = user && !isCreator;

  const handleSignOut = async () => {
    try {
      // 清除浏览器 Session
      await signOut();

      // 清除 LocalStorage
      if (typeof window !== "undefined") {
        localStorage.clear();
      }

      // 强制重定向至首页
      router.push("/");
      router.refresh();
    } catch (err) {
      console.error("[NavHeader] signOut error:", err);
    }
  };

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
          <Link href="/search" className="w-full">
            <Button
              variant="outline"
              className="w-full justify-start text-muted-foreground bg-background hover:bg-accent transition-colors"
              aria-label="Search for creators and content"
            >
              <Search className="w-4 h-4 mr-2" aria-hidden="true" />
              Search creators...
            </Button>
          </Link>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* 移动端搜索按钮 */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden min-h-[44px] min-w-[44px]"
            asChild
            aria-label="Search creators"
          >
            <Link href="/search">
              <Search className="w-5 h-5" aria-hidden="true" />
            </Link>
          </Button>

          {/* 常驻转化入口：顶部导航栏固定展示 Become a Creator 渐变按钮 */}
          {showBecomeCreator && (
            <Button asChild variant="gradient" className="hidden md:flex rounded-xl">
              <Link href="/creator/upgrade">
                <Sparkles className="w-4 h-4 mr-2" aria-hidden="true" />
                Become a Creator
              </Link>
            </Button>
          )}

          {user && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="relative min-h-[44px] min-w-[44px]"
                asChild
                aria-label={`Notifications${notificationCount > 0 ? `, ${notificationCount} unread` : ""}`}
              >
                <Link href="/notifications">
                  <Bell className="w-5 h-5" aria-hidden="true" />
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
                            <Badge
                              variant="secondary"
                              className="text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            >
                              Pending
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Wallet Balance Preview */}
                    <div className="mb-4">
                      <WalletBalancePreview />
                    </div>
                    <Separator className="mb-4" />
                  </div>

                  <nav className="flex flex-col gap-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Discover
                    </p>
                    <Button
                      variant={pathname === "/home" ? "secondary" : "ghost"}
                      className="justify-start min-h-[44px]"
                      asChild
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Link href="/home">
                        <Home className="w-4 h-4 mr-3" aria-hidden="true" />
                        Feed
                      </Link>
                    </Button>
                    <Separator className="my-2" />

                    {!isCreator && (
                      <>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          Your Content
                        </p>
                        <Button
                          variant={pathname === "/subscriptions" ? "secondary" : "ghost"}
                          className="justify-start min-h-[44px]"
                          asChild
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <Link href="/subscriptions">
                            <Heart className="w-4 h-4 mr-3" aria-hidden="true" />
                            Subscriptions
                          </Link>
                        </Button>
                        <Button
                          variant={pathname === "/purchases" ? "secondary" : "ghost"}
                          className="justify-start min-h-[44px]"
                          asChild
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <Link href="/purchases">
                            <CreditCard className="w-4 h-4 mr-3" aria-hidden="true" />
                            Purchases
                          </Link>
                        </Button>
                        <Separator className="my-2" />
                      </>
                    )}

                    {isCreator && (
                      <>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          Creator Studio
                        </p>
                        <Button
                          variant={pathname === "/creator/studio" ? "secondary" : "ghost"}
                          className="justify-start min-h-[44px]"
                          asChild
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <Link href="/creator/studio">
                            <LayoutDashboard className="w-4 h-4 mr-3" aria-hidden="true" />
                            Dashboard
                          </Link>
                        </Button>
                        <Button
                          variant={
                            pathname?.startsWith("/creator/new-post") ? "secondary" : "ghost"
                          }
                          className="justify-start min-h-[44px]"
                          asChild
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <Link href="/creator/new-post">
                            <FileText className="w-4 h-4 mr-3" aria-hidden="true" />
                            New Post
                          </Link>
                        </Button>
                        <Button
                          variant={pathname === "/creator/studio/earnings" ? "secondary" : "ghost"}
                          className="justify-start min-h-[44px]"
                          asChild
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <Link href="/creator/studio/earnings">
                            <DollarSign className="w-4 h-4 mr-3" aria-hidden="true" />
                            Earnings
                          </Link>
                        </Button>
                        <Separator className="my-2" />
                      </>
                    )}

                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Account
                    </p>
                    <Button
                      variant={pathname === "/me" ? "secondary" : "ghost"}
                      className="justify-start min-h-[44px]"
                      asChild
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Link href="/me">
                        <User className="w-4 h-4 mr-3" aria-hidden="true" />
                        Profile
                      </Link>
                    </Button>

                    {showBecomeCreator && (
                      <>
                        <Separator className="my-2" />
                        <Button
                          variant="gradient"
                          className="justify-start rounded-xl min-h-[44px]"
                          asChild
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <Link href="/creator/upgrade">
                            <Sparkles className="w-4 h-4 mr-3" aria-hidden="true" />
                            Become a Creator
                          </Link>
                        </Button>
                      </>
                    )}

                    {/* 退出登录：在个人菜单底部增加真实的 Sign Out 动作 */}
                    <Separator className="my-2" />
                    <Button
                      variant="ghost"
                      className="justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={async () => {
                        setMobileMenuOpen(false);
                        await handleSignOut();
                      }}
                      aria-label="Sign out of your account"
                    >
                      <LogOut className="w-4 h-4 mr-3" aria-hidden="true" />
                      Sign Out
                    </Button>
                  </nav>
                </SheetContent>
              </Sheet>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
