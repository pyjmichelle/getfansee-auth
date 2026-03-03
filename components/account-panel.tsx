"use client";

import Link from "next/link";
import {
  User,
  Heart,
  Wallet,
  Settings,
  LogOut,
  LayoutDashboard,
  FileText,
  DollarSign,
  Sparkles,
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
        className="w-64 bg-surface-base border-border-base rounded-xl p-2"
      >
        {/* User Info */}
        <DropdownMenuLabel className="p-3">
          <div className="flex items-center gap-3">
            <Avatar className="w-10 h-10">
              <AvatarImage src={user.avatar || DEFAULT_AVATAR_FAN} alt={user.username} />
              <AvatarFallback className="bg-brand-primary/10 text-brand-primary font-semibold">
                {(user.username?.[0] || "U").toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-text-primary truncate">{user.username}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="text-xs">
                  {isCreator ? "Creator" : "Fan"}
                </Badge>
                {isCreator && user.creatorStatus === "pending" && (
                  <Badge variant="secondary" className="text-xs bg-warning/10 text-warning">
                    Pending
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </DropdownMenuLabel>

        {/* Wallet Balance */}
        <div className="px-3 py-2 mb-2">
          <div className="flex items-center justify-between p-3 rounded-lg bg-gradient-primary text-white">
            <div>
              <p className="text-white/80 text-xs">Balance</p>
              <p className="text-lg font-bold">${balance.toFixed(2)}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/20 min-h-[36px]"
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
          className="cursor-pointer rounded-lg hover:bg-brand-primary/5 min-h-[40px]"
        >
          <Link href="/me" className="flex items-center gap-2 py-2">
            <User className="w-4 h-4 text-text-tertiary" aria-hidden="true" />
            <span className="text-text-primary">Profile</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem
          asChild
          className="cursor-pointer rounded-lg hover:bg-brand-primary/5 min-h-[40px]"
        >
          <Link href="/subscriptions" className="flex items-center gap-2 py-2">
            <Heart className="w-4 h-4 text-text-tertiary" aria-hidden="true" />
            <span className="text-text-primary">Subscriptions</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem
          asChild
          className="cursor-pointer rounded-lg hover:bg-brand-primary/5 min-h-[40px]"
        >
          <Link href="/me/wallet" className="flex items-center gap-2 py-2">
            <Wallet className="w-4 h-4 text-text-tertiary" aria-hidden="true" />
            <span className="text-text-primary">Wallet</span>
          </Link>
        </DropdownMenuItem>

        {/* Creator Studio */}
        {isCreator && (
          <>
            <DropdownMenuSeparator className="bg-border-base" />
            <DropdownMenuLabel className="text-xs text-text-tertiary uppercase tracking-wider px-2 py-1">
              Creator Studio
            </DropdownMenuLabel>
            <DropdownMenuItem
              asChild
              className="cursor-pointer rounded-lg hover:bg-brand-primary/5 min-h-[40px]"
            >
              <Link href="/creator/studio" className="flex items-center gap-2 py-2">
                <LayoutDashboard className="w-4 h-4 text-text-tertiary" aria-hidden="true" />
                <span className="text-text-primary">Dashboard</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              asChild
              className="cursor-pointer rounded-lg hover:bg-brand-primary/5 min-h-[40px]"
            >
              <Link href="/creator/new-post" className="flex items-center gap-2 py-2">
                <FileText className="w-4 h-4 text-text-tertiary" aria-hidden="true" />
                <span className="text-text-primary">New Post</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              asChild
              className="cursor-pointer rounded-lg hover:bg-brand-primary/5 min-h-[40px]"
            >
              <Link href="/creator/studio/earnings" className="flex items-center gap-2 py-2">
                <DollarSign className="w-4 h-4 text-text-tertiary" aria-hidden="true" />
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
              className="cursor-pointer rounded-lg hover:bg-brand-primary/5 min-h-[40px]"
            >
              <Link
                href="/creator/upgrade"
                className="flex items-center gap-2 py-2 text-brand-primary"
              >
                <Sparkles className="w-4 h-4" aria-hidden="true" />
                <span className="font-medium">Become a Creator</span>
              </Link>
            </DropdownMenuItem>
          </>
        )}

        <DropdownMenuSeparator className="bg-border-base" />

        <DropdownMenuItem
          asChild
          className="cursor-pointer rounded-lg hover:bg-brand-primary/5 min-h-[40px]"
        >
          <Link href="/settings" className="flex items-center gap-2 py-2">
            <Settings className="w-4 h-4 text-text-tertiary" aria-hidden="true" />
            <span className="text-text-primary">Settings</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem
          className="cursor-pointer rounded-lg text-error focus:text-error hover:bg-error/5 min-h-[40px]"
          onClick={onSignOut}
          aria-label="Sign out of your account"
        >
          <LogOut className="w-4 h-4 mr-2" aria-hidden="true" />
          <span>Sign Out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
