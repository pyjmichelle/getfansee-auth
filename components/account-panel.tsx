"use client";

import Link from "next/link";
import {
  User,
  Heart,
  Wallet,
  LogOut,
  LayoutDashboard,
  FileText,
  DollarSign,
  Sparkles,
  ShoppingBag,
} from "@/lib/icons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { DEFAULT_AVATAR_FAN } from "@/lib/image-fallbacks";

interface AccountPanelProps {
  user: {
    username: string;
    email?: string;
    role: "fan" | "creator";
    avatar?: string;
    creatorStatus?: "pending" | "approved";
  };
  balance?: number;
  onSignOut?: () => void;
  className?: string;
}

export function AccountPanel({ user, balance = 0, onSignOut, className }: AccountPanelProps) {
  const isCreator = user.role === "creator";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "flex items-center gap-2 px-3 hover:bg-surface-raised active:scale-95 transition-all min-h-[44px] focus-visible:ring-2 focus-visible:ring-brand-primary",
            className
          )}
          aria-label={`Account menu for ${user.username}`}
        >
          <Avatar className="w-8 h-8 ring-2 ring-transparent hover:ring-brand-primary/30 transition-all">
            <AvatarImage src={user.avatar || DEFAULT_AVATAR_FAN} alt={user.username} />
            <AvatarFallback className="bg-brand-primary/10 text-brand-primary text-sm font-semibold">
              {(user.username?.[0] || "U").toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="font-medium text-sm hidden md:inline text-text-primary">
            {user.username}
          </span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-56 bg-surface-base border-border-base rounded-xl p-1.5"
      >
        {/* User Info */}
        <DropdownMenuLabel className="px-2 py-1.5">
          <div className="flex items-center gap-2">
            <Avatar className="w-8 h-8">
              <AvatarImage src={user.avatar || DEFAULT_AVATAR_FAN} alt={user.username} />
              <AvatarFallback className="bg-brand-primary/10 text-brand-primary font-semibold text-xs">
                {(user.username?.[0] || "U").toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-[13px] text-text-primary truncate">
                {user.username}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {isCreator ? "Creator" : "Fan"}
                </Badge>
                {isCreator && user.creatorStatus === "pending" && (
                  <Badge
                    variant="secondary"
                    className="text-[10px] px-1.5 py-0 bg-warning/10 text-warning"
                  >
                    Pending
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </DropdownMenuLabel>

        {/* Wallet Balance */}
        <div className="px-2 py-1 mb-1">
          <div className="flex items-center justify-between px-2.5 py-2 rounded-lg bg-gradient-primary text-white">
            <div>
              <p className="text-white/70 text-[10px]">Balance</p>
              <p className="text-sm font-bold">${balance.toFixed(2)}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/20 h-7 text-xs px-2"
              asChild
            >
              <Link href="/me/wallet">Add</Link>
            </Button>
          </div>
        </div>

        <DropdownMenuSeparator className="bg-border-base" />

        {/* Navigation Items */}
        <DropdownMenuItem
          asChild
          className="cursor-pointer rounded-md hover:bg-brand-primary/5 min-h-[34px] text-[13px]"
        >
          <Link href="/me" className="flex items-center gap-2">
            <User className="w-3.5 h-3.5 text-text-tertiary" aria-hidden="true" />
            <span className="text-text-primary">Profile</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem
          asChild
          className="cursor-pointer rounded-md hover:bg-brand-primary/5 min-h-[34px] text-[13px]"
        >
          <Link href="/subscriptions" className="flex items-center gap-2">
            <Heart className="w-3.5 h-3.5 text-text-tertiary" aria-hidden="true" />
            <span className="text-text-primary">Subscriptions</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem
          asChild
          className="cursor-pointer rounded-md hover:bg-brand-primary/5 min-h-[34px] text-[13px]"
        >
          <Link href="/purchases" className="flex items-center gap-2">
            <ShoppingBag className="w-3.5 h-3.5 text-text-tertiary" aria-hidden="true" />
            <span className="text-text-primary">Purchases</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem
          asChild
          className="cursor-pointer rounded-md hover:bg-brand-primary/5 min-h-[34px] text-[13px]"
        >
          <Link href="/me/wallet" className="flex items-center gap-2">
            <Wallet className="w-3.5 h-3.5 text-text-tertiary" aria-hidden="true" />
            <span className="text-text-primary">Wallet</span>
          </Link>
        </DropdownMenuItem>

        {/* Creator Studio */}
        {isCreator && (
          <>
            <DropdownMenuSeparator className="bg-border-base" />
            <DropdownMenuLabel className="text-[10px] text-text-tertiary uppercase tracking-wider px-2 py-1">
              Creator Studio
            </DropdownMenuLabel>
            <DropdownMenuItem
              asChild
              className="cursor-pointer rounded-md hover:bg-brand-primary/5 min-h-[34px] text-[13px]"
            >
              <Link href="/creator/studio" className="flex items-center gap-2">
                <LayoutDashboard className="w-3.5 h-3.5 text-text-tertiary" aria-hidden="true" />
                <span className="text-text-primary">Dashboard</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              asChild
              className="cursor-pointer rounded-md hover:bg-brand-primary/5 min-h-[34px] text-[13px]"
            >
              <Link href="/creator/new-post" className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-text-tertiary" aria-hidden="true" />
                <span className="text-text-primary">New Post</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              asChild
              className="cursor-pointer rounded-md hover:bg-brand-primary/5 min-h-[34px] text-[13px]"
            >
              <Link href="/creator/studio/earnings" className="flex items-center gap-2">
                <DollarSign className="w-3.5 h-3.5 text-text-tertiary" aria-hidden="true" />
                <span className="text-text-primary">Earnings</span>
              </Link>
            </DropdownMenuItem>
          </>
        )}

        {/* Become Creator */}
        {!isCreator && (
          <>
            <DropdownMenuSeparator className="bg-border-base" />
            <DropdownMenuItem
              asChild
              className="cursor-pointer rounded-md hover:bg-brand-primary/5 min-h-[34px] text-[13px]"
            >
              <Link href="/creator/upgrade" className="flex items-center gap-2 text-brand-primary">
                <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="font-medium">Become a Creator</span>
              </Link>
            </DropdownMenuItem>
          </>
        )}

        <DropdownMenuSeparator className="bg-border-base" />

        <DropdownMenuItem
          className="cursor-pointer rounded-md text-error focus:text-error hover:bg-error/5 min-h-[34px] text-[13px]"
          onClick={onSignOut}
          aria-label="Sign out of your account"
        >
          <LogOut className="w-3.5 h-3.5 mr-2" aria-hidden="true" />
          <span>Sign Out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
