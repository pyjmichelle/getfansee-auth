"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Search,
  Home,
  Heart,
  CreditCard,
  User,
  LayoutDashboard,
  FileText,
  DollarSign,
  Sparkles,
  LogOut,
  Wallet,
} from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth";
import { WalletBalancePreview } from "@/components/wallet-balance-preview";
import { SearchModal } from "@/components/search-modal";
import { AccountPanel } from "@/components/account-panel";
import { cn } from "@/lib/utils";
import { DEFAULT_AVATAR_FAN } from "@/lib/image-fallbacks";
import { startRouteTransition } from "@/lib/perf-client";

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
  const showBecomeCreator = user && !isCreator;

  const handleSignOut = async () => {
    try {
      await signOut();
      if (typeof window !== "undefined") {
        localStorage.removeItem("pending_signup_email");
        localStorage.removeItem("pending_signup_username");
      }
      router.push("/");
    } catch (err) {
      console.error("[NavHeader] signOut error:", err);
    }
  };

  const navItemClass = (active: boolean | undefined) =>
    cn(
      "flex items-center gap-3 w-full h-10 px-3 rounded-[var(--radius-sm)]",
      "text-[13px] font-medium transition-[background-color,color] duration-100",
      active
        ? "bg-violet-500/10 text-white border-l-2 border-violet-500"
        : "text-text-secondary hover:bg-white/5 hover:text-white"
    );

  const trackRouteStart = (href: string) => {
    startRouteTransition(href, pathname ?? undefined);
  };

  const warmRoute = (href: string) => {
    router.prefetch(href);
  };

  useEffect(() => {
    const baseRoutes = ["/home", "/search", "/notifications", "/me", "/me/wallet"];
    baseRoutes.forEach((route) => router.prefetch(route));
    if (isCreator) {
      [
        "/creator/studio",
        "/creator/new-post",
        "/creator/studio/earnings",
        "/creator/studio/subscribers",
        "/creator/studio/post/list",
      ].forEach((route) => router.prefetch(route));
      ["/admin", "/admin/reports", "/admin/content-review", "/admin/creator-verifications"].forEach(
        (route) => router.prefetch(route)
      );
    } else {
      ["/subscriptions", "/purchases", "/creator/upgrade"].forEach((route) =>
        router.prefetch(route)
      );
    }
  }, [isCreator, router]);

  return (
    <header
      className="sticky top-0 w-full glass-nav"
      style={{
        zIndex: "var(--z-nav)" as unknown as number,
        paddingTop: "env(safe-area-inset-top)",
      }}
    >
      <div className="flex h-12 md:h-[52px] items-center justify-between px-3 md:px-5 max-w-[1280px] mx-auto">
        {/* Logo */}
        <Link
          href="/home"
          className="flex items-center gap-2 group shrink-0"
          onMouseEnter={() => warmRoute("/home")}
          onTouchStart={() => warmRoute("/home")}
          onClick={() => trackRouteStart("/home")}
        >
          <div className="w-7 h-7 rounded-[var(--radius-sm)] bg-gradient-to-br from-violet-600 to-violet-400 flex items-center justify-center shadow-glow-violet group-hover:shadow-glow-violet-lg transition-shadow duration-200">
            <span className="text-white font-bold text-[13px]">G</span>
          </div>
          <span className="font-bold text-[15px] hidden md:inline text-white tracking-tight">
            GetFanSee
          </span>
        </Link>

        {/* Desktop search bar */}
        <div className="hidden md:flex flex-1 max-w-[240px] mx-6">
          <button
            type="button"
            className={cn(
              "w-full flex items-center gap-2 h-8 px-3",
              "glass-input rounded-[var(--radius-sm)]",
              "text-[13px] text-white/30",
              "hover:border-white/15 transition-[border-color] duration-150"
            )}
            onClick={() => setSearchOpen(true)}
            aria-label="Search creators, tags..."
            data-testid="search-button"
          >
            <Search className="size-[14px] shrink-0" aria-hidden="true" />
            <span>Search creators, tags...</span>
          </button>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1.5">
          {/* Mobile search */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden size-9"
            asChild
            aria-label="Search"
            data-testid="search-button-mobile"
          >
            <Link
              href="/search"
              onMouseEnter={() => warmRoute("/search")}
              onTouchStart={() => warmRoute("/search")}
              onClick={() => trackRouteStart("/search")}
            >
              <Search className="size-[18px]" />
            </Link>
          </Button>

          {/* Become Creator CTA */}
          {showBecomeCreator && (
            <Button asChild variant="violet" size="sm" className="hidden md:flex gap-1.5">
              <Link
                href="/creator/upgrade"
                onMouseEnter={() => warmRoute("/creator/upgrade")}
                onTouchStart={() => warmRoute("/creator/upgrade")}
                onClick={() => trackRouteStart("/creator/upgrade")}
              >
                <Sparkles className="size-[13px]" />
                Start Creating
              </Link>
            </Button>
          )}

          {user ? (
            <>
              {/* Notifications */}
              <Button
                variant="ghost"
                size="icon"
                className="relative size-9"
                asChild
                aria-label={`Notifications${notificationCount > 0 ? `, ${notificationCount} unread` : ""}`}
              >
                <Link
                  href="/notifications"
                  onMouseEnter={() => warmRoute("/notifications")}
                  onTouchStart={() => warmRoute("/notifications")}
                  onClick={() => trackRouteStart("/notifications")}
                >
                  <Bell className="size-[18px]" aria-hidden="true" />
                  {notificationCount > 0 && (
                    <Badge
                      variant="purple"
                      className="absolute -top-0.5 -right-0.5 h-[18px] min-w-[18px] flex items-center justify-center p-0 text-[10px] rounded-full bg-violet-500 text-white border-none"
                    >
                      {notificationCount > 9 ? "9+" : notificationCount}
                    </Badge>
                  )}
                </Link>
              </Button>

              {/* PC端：AccountPanel DropdownMenu */}
              <AccountPanel user={user} onSignOut={handleSignOut} className="hidden md:flex" />

              {/* 移动端：Sheet 侧滑菜单 */}
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <button
                    className="flex md:hidden items-center gap-1.5 px-1 py-1 rounded-[var(--radius-sm)] hover:bg-white/8 transition-colors duration-100"
                    aria-label="Open menu"
                  >
                    <Avatar className="size-7">
                      <AvatarImage src={user.avatar || DEFAULT_AVATAR_FAN} />
                      <AvatarFallback>{(user.username?.[0] || "U").toUpperCase()}</AvatarFallback>
                    </Avatar>
                  </button>
                </SheetTrigger>

                <SheetContent side="right" className="w-[85vw] max-w-[320px] overflow-y-auto">
                  {/* User info */}
                  <div className="px-4 py-4">
                    <div className="flex items-center gap-3 mb-4">
                      <Avatar className="size-12 ring-1 ring-white/10">
                        <AvatarImage src={user.avatar || DEFAULT_AVATAR_FAN} alt={user.username} />
                        <AvatarFallback className="text-[16px] font-semibold">
                          {(user.username?.[0] || "U").toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[14px] text-white truncate">
                          {user.username}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <Badge variant={isCreator ? "purple" : "default"} className="text-[10px]">
                            {isCreator ? "Creator" : "Fan"}
                          </Badge>
                          {isCreator && user.creatorStatus === "pending" && (
                            <Badge variant="warning" className="text-[10px]">
                              Pending
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Wallet */}
                    <div className="mb-3">
                      <WalletBalancePreview />
                    </div>
                    <Separator />
                  </div>

                  <nav className="flex flex-col px-4 pb-4 gap-0.5">
                    <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1.5 mt-1">
                      Discover
                    </p>
                    <Link
                      href="/home"
                      className={navItemClass(pathname === "/home")}
                      onMouseEnter={() => warmRoute("/home")}
                      onTouchStart={() => warmRoute("/home")}
                      onClick={() => {
                        trackRouteStart("/home");
                        setMobileMenuOpen(false);
                      }}
                    >
                      <Home className="size-[16px]" />
                      Feed
                    </Link>

                    {!isCreator && (
                      <>
                        <Separator className="my-2" />
                        <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">
                          Your Content
                        </p>
                        <Link
                          href="/subscriptions"
                          className={navItemClass(pathname === "/subscriptions")}
                          onMouseEnter={() => warmRoute("/subscriptions")}
                          onTouchStart={() => warmRoute("/subscriptions")}
                          onClick={() => {
                            trackRouteStart("/subscriptions");
                            setMobileMenuOpen(false);
                          }}
                        >
                          <Heart className="size-[16px]" />
                          Subscriptions
                        </Link>
                        <Link
                          href="/purchases"
                          className={navItemClass(pathname === "/purchases")}
                          onMouseEnter={() => warmRoute("/purchases")}
                          onTouchStart={() => warmRoute("/purchases")}
                          onClick={() => {
                            trackRouteStart("/purchases");
                            setMobileMenuOpen(false);
                          }}
                        >
                          <CreditCard className="size-[16px]" />
                          Purchases
                        </Link>
                      </>
                    )}

                    {isCreator && (
                      <>
                        <Separator className="my-2" />
                        <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">
                          Creator Studio
                        </p>
                        <Link
                          href="/creator/studio"
                          className={navItemClass(pathname === "/creator/studio")}
                          onMouseEnter={() => warmRoute("/creator/studio")}
                          onTouchStart={() => warmRoute("/creator/studio")}
                          onClick={() => {
                            trackRouteStart("/creator/studio");
                            setMobileMenuOpen(false);
                          }}
                        >
                          <LayoutDashboard className="size-[16px]" />
                          Dashboard
                        </Link>
                        <Link
                          href="/creator/new-post"
                          className={navItemClass(pathname?.startsWith("/creator/new-post"))}
                          onMouseEnter={() => warmRoute("/creator/new-post")}
                          onTouchStart={() => warmRoute("/creator/new-post")}
                          onClick={() => {
                            trackRouteStart("/creator/new-post");
                            setMobileMenuOpen(false);
                          }}
                        >
                          <FileText className="size-[16px]" />
                          New Post
                        </Link>
                        <Link
                          href="/creator/studio/earnings"
                          className={navItemClass(pathname === "/creator/studio/earnings")}
                          onMouseEnter={() => warmRoute("/creator/studio/earnings")}
                          onTouchStart={() => warmRoute("/creator/studio/earnings")}
                          onClick={() => {
                            trackRouteStart("/creator/studio/earnings");
                            setMobileMenuOpen(false);
                          }}
                        >
                          <DollarSign className="size-[16px]" />
                          Earnings
                        </Link>
                      </>
                    )}

                    <Separator className="my-2" />
                    <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">
                      Account
                    </p>
                    <Link
                      href="/me"
                      className={navItemClass(pathname === "/me")}
                      onMouseEnter={() => warmRoute("/me")}
                      onTouchStart={() => warmRoute("/me")}
                      onClick={() => {
                        trackRouteStart("/me");
                        setMobileMenuOpen(false);
                      }}
                    >
                      <User className="size-[16px]" />
                      Profile
                    </Link>
                    <Link
                      href="/me/wallet"
                      className={navItemClass(pathname === "/me/wallet")}
                      onMouseEnter={() => warmRoute("/me/wallet")}
                      onTouchStart={() => warmRoute("/me/wallet")}
                      onClick={() => {
                        trackRouteStart("/me/wallet");
                        setMobileMenuOpen(false);
                      }}
                    >
                      <Wallet className="size-[16px]" />
                      Wallet
                    </Link>

                    {showBecomeCreator && (
                      <>
                        <Separator className="my-2" />
                        <Link
                          href="/creator/upgrade"
                          className="flex items-center gap-2 w-full h-9 px-3 rounded-[var(--radius-sm)] bg-gradient-to-r from-violet-600 to-violet-500 text-white text-[13px] font-medium shadow-glow-violet hover:brightness-110 transition-[filter] duration-150"
                          onMouseEnter={() => warmRoute("/creator/upgrade")}
                          onTouchStart={() => warmRoute("/creator/upgrade")}
                          onClick={() => {
                            trackRouteStart("/creator/upgrade");
                            setMobileMenuOpen(false);
                          }}
                        >
                          <Sparkles className="size-[14px]" />
                          Start Creating
                        </Link>
                      </>
                    )}

                    <Separator className="my-2" />
                    <button
                      className="flex items-center gap-3 w-full h-10 px-3 rounded-[var(--radius-sm)] text-[13px] font-medium text-red-400 hover:bg-red-500/10 transition-colors duration-100"
                      onClick={async () => {
                        setMobileMenuOpen(false);
                        await handleSignOut();
                      }}
                      aria-label="Sign out"
                    >
                      <LogOut className="size-[16px]" />
                      Sign Out
                    </button>
                  </nav>
                </SheetContent>
              </Sheet>
            </>
          ) : (
            <div className="flex items-center gap-1.5">
              <Button asChild variant="ghost" size="sm">
                <Link href="/auth">Sign In</Link>
              </Button>
              <Button asChild variant="violet" size="sm">
                <Link href="/auth?tab=signup">Join</Link>
              </Button>
            </div>
          )}
        </div>
      </div>

      <SearchModal open={searchOpen} onOpenChange={setSearchOpen} />
    </header>
  );
}
