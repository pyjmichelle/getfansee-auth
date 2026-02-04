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
import { SearchModal } from "@/components/search-modal";

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
    <header className="sticky top-0 z-50 w-full border-b border-border/50 glass-strong">
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
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start text-muted-foreground bg-background hover:bg-accent hover:border-primary/50 hover:text-foreground transition-[background-color,border-color,color] duration-200 motion-safe:transition-[background-color,border-color,color] motion-reduce:transition-none border-2 rounded-xl min-h-[44px] shadow-sm focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            aria-label="Search for creators and content"
            data-testid="search-button"
            onClick={() => setSearchOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setSearchOpen(true);
              }
            }}
          >
            <Search
              className="w-4 h-4 mr-2 text-muted-foreground group-hover:text-foreground transition-colors"
              aria-hidden="true"
            />
            <span className="text-sm">Search creators, posts, tags…</span>
          </Button>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* 移动端搜索按钮 */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden min-h-[44px] min-w-[44px] rounded-xl hover:bg-accent hover:text-foreground transition-[background-color,color] duration-200 motion-safe:transition-[background-color,color] motion-reduce:transition-none"
            asChild
            aria-label="Search creators and content"
            data-testid="search-button-mobile"
          >
            <Link href="/search">
              <Search className="w-5 h-5" aria-hidden="true" />
            </Link>
          </Button>

          {/* 常驻转化入口：顶部导航栏固定展示 Become a Creator 渐变按钮 */}
          {showBecomeCreator && (
            <Button
              asChild
              variant="subscribe-gradient"
              className="hidden md:flex rounded-xl min-h-[44px] font-semibold shadow-lg"
            >
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
                <SheetContent side="right" className="w-[85vw] max-w-sm">
                  <div className="mb-6 pt-6 px-1">
                    <div className="flex items-center gap-4 mb-6 px-2">
                      <Avatar className="w-14 h-14 ring-2 ring-primary/20 shadow-sm">
                        <AvatarImage src={user.avatar || "/placeholder.svg"} alt={user.username} />
                        <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
                          {user.username[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-foreground text-base truncate">
                          {user.username}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="secondary" className="text-xs font-medium">
                            {isCreator ? "Creator" : "Fan"}
                          </Badge>
                          {isCreator && user.creatorStatus === "pending" && (
                            <Badge
                              variant="secondary"
                              className="text-xs bg-[var(--bg-purple-500-10)] text-[var(--color-purple-400)] border-[var(--border-purple-500-20)]"
                            >
                              Pending
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Wallet Balance Preview */}
                    <div className="mb-6 px-2">
                      <WalletBalancePreview />
                    </div>
                    <Separator className="mb-6" />
                  </div>

                  <nav className="flex flex-col gap-1.5 px-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 mt-1">
                      Discover
                    </p>
                    <Button
                      variant={pathname === "/home" ? "secondary" : "ghost"}
                      className="justify-start min-h-[48px] rounded-xl transition-[background-color,color] duration-200 motion-safe:transition-[background-color,color] motion-reduce:transition-none hover:bg-accent/80"
                      asChild
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Link href="/home">
                        <Home className="w-5 h-5 mr-3" aria-hidden="true" />
                        <span className="font-medium">Feed</span>
                      </Link>
                    </Button>
                    <Separator className="my-3" />

                    {!isCreator && (
                      <>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 mt-1">
                          Your Content
                        </p>
                        <Button
                          variant={pathname === "/subscriptions" ? "secondary" : "ghost"}
                          className="justify-start min-h-[48px] rounded-xl transition-[background-color,color] duration-200 motion-safe:transition-[background-color,color] motion-reduce:transition-none hover:bg-accent/80"
                          asChild
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <Link href="/subscriptions">
                            <Heart className="w-5 h-5 mr-3" aria-hidden="true" />
                            <span className="font-medium">Subscriptions</span>
                          </Link>
                        </Button>
                        <Button
                          variant={pathname === "/purchases" ? "secondary" : "ghost"}
                          className="justify-start min-h-[48px] rounded-xl transition-[background-color,color] duration-200 motion-safe:transition-[background-color,color] motion-reduce:transition-none hover:bg-accent/80"
                          asChild
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <Link href="/purchases">
                            <CreditCard className="w-5 h-5 mr-3" aria-hidden="true" />
                            <span className="font-medium">Purchases</span>
                          </Link>
                        </Button>
                        <Separator className="my-3" />
                      </>
                    )}

                    {isCreator && (
                      <>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-2">
                          Creator Studio
                        </p>
                        <Button
                          variant={pathname === "/creator/studio" ? "secondary" : "ghost"}
                          className="justify-start min-h-[48px] rounded-xl transition-[background-color,color] duration-200 motion-safe:transition-[background-color,color] motion-reduce:transition-none hover:bg-accent/80"
                          asChild
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <Link href="/creator/studio">
                            <LayoutDashboard className="w-5 h-5 mr-3" aria-hidden="true" />
                            <span className="font-medium">Dashboard</span>
                          </Link>
                        </Button>
                        <Button
                          variant={
                            pathname?.startsWith("/creator/new-post") ? "secondary" : "ghost"
                          }
                          className="justify-start min-h-[48px] rounded-xl transition-[background-color,color] duration-200 motion-safe:transition-[background-color,color] motion-reduce:transition-none hover:bg-accent/80"
                          asChild
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <Link href="/creator/new-post">
                            <FileText className="w-5 h-5 mr-3" aria-hidden="true" />
                            <span className="font-medium">New Post</span>
                          </Link>
                        </Button>
                        <Button
                          variant={pathname === "/creator/studio/earnings" ? "secondary" : "ghost"}
                          className="justify-start min-h-[48px] rounded-xl transition-[background-color,color] duration-200 motion-safe:transition-[background-color,color] motion-reduce:transition-none hover:bg-accent/80"
                          asChild
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <Link href="/creator/studio/earnings">
                            <DollarSign className="w-5 h-5 mr-3" aria-hidden="true" />
                            <span className="font-medium">Earnings</span>
                          </Link>
                        </Button>
                        <Separator className="my-3" />
                      </>
                    )}

                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 mt-1">
                      Account
                    </p>
                    <Button
                      variant={pathname === "/me" ? "secondary" : "ghost"}
                      className="justify-start min-h-[48px] rounded-xl transition-[background-color,color] duration-200 motion-safe:transition-[background-color,color] motion-reduce:transition-none hover:bg-accent/80"
                      asChild
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Link href="/me">
                        <User className="w-5 h-5 mr-3" aria-hidden="true" />
                        <span className="font-medium">Profile</span>
                      </Link>
                    </Button>

                    {showBecomeCreator && (
                      <>
                        <Separator className="my-3" />
                        <Button
                          variant="subscribe-gradient"
                          className="justify-start rounded-xl min-h-[48px] font-bold shadow-lg hover:shadow-subscribe-glow hover-glow transition-[box-shadow,transform] duration-200 motion-safe:transition-[box-shadow,transform] motion-reduce:transition-none"
                          asChild
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <Link href="/creator/upgrade">
                            <Sparkles className="w-5 h-5 mr-3" aria-hidden="true" />
                            <span>Become a Creator</span>
                          </Link>
                        </Button>
                      </>
                    )}

                    {/* 退出登录：在个人菜单底部增加真实的 Sign Out 动作 */}
                    <Separator className="my-3" />
                    <Button
                      variant="ghost"
                      className="justify-start text-destructive hover:text-destructive hover:bg-destructive/10 min-h-[48px] rounded-xl transition-[color,background-color] duration-200 motion-safe:transition-[color,background-color] motion-reduce:transition-none"
                      onClick={async () => {
                        setMobileMenuOpen(false);
                        await handleSignOut();
                      }}
                      aria-label="Sign out of your account"
                    >
                      <LogOut className="w-5 h-5 mr-3" aria-hidden="true" />
                      <span className="font-medium">Sign Out</span>
                    </Button>
                  </nav>
                </SheetContent>
              </Sheet>
            </>
          )}
        </div>
        <SearchModal open={searchOpen} onOpenChange={setSearchOpen} />
      </div>
    </header>
  );
}
