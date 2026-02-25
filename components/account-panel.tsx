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
} from "lucide-react";
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

/**
 * AccountPanel - Figma Make style user dropdown menu
 *
 * Features:
 * - User avatar + name + role badge
 * - Wallet balance display
 * - Navigation links based on role
 * - Sign out action
 */
export function AccountPanel({ user, balance = 0, onSignOut, className }: AccountPanelProps) {
  const isCreator = user.role === "creator";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn("flex items-center gap-2 px-3 hover:bg-muted", className)}
        >
          <Avatar className="w-8 h-8 ring-2 ring-transparent hover:ring-primary/30 transition-all">
            <AvatarImage src={user.avatar || "/placeholder.svg"} alt={user.username} />
            <AvatarFallback className="bg-primary-muted text-primary text-sm font-semibold">
              {user.username[0].toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="font-medium text-sm hidden md:inline">{user.username}</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64 bg-card border-border rounded-xl p-2">
        {/* User Info */}
        <DropdownMenuLabel className="p-3">
          <div className="flex items-center gap-3">
            <Avatar className="w-10 h-10">
              <AvatarImage src={user.avatar || "/placeholder.svg"} alt={user.username} />
              <AvatarFallback className="bg-primary-muted text-primary font-semibold">
                {user.username[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground truncate">{user.username}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="text-xs">
                  {isCreator ? "Creator" : "Fan"}
                </Badge>
                {isCreator && user.creatorStatus === "pending" && (
                  <Badge variant="secondary" className="text-xs bg-warning-muted text-warning">
                    Pending
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </DropdownMenuLabel>

        {/* Wallet Balance */}
        <div className="px-3 py-2 mb-2">
          <div className="flex items-center justify-between p-3 rounded-lg bg-gradient-balance text-white">
            <div>
              <p className="text-white/80 text-xs">Balance</p>
              <p className="text-lg font-bold">${balance.toFixed(2)}</p>
            </div>
            <Button variant="ghost" size="sm" className="text-white hover:bg-white/20" asChild>
              <Link href="/me/wallet">Add</Link>
            </Button>
          </div>
        </div>

        <DropdownMenuSeparator className="bg-border" />

        {/* Navigation Items */}
        <DropdownMenuItem asChild className="cursor-pointer rounded-lg">
          <Link href="/me" className="flex items-center gap-2 py-2">
            <User className="w-4 h-4" />
            <span>Profile</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild className="cursor-pointer rounded-lg">
          <Link href="/subscriptions" className="flex items-center gap-2 py-2">
            <Heart className="w-4 h-4" />
            <span>Subscriptions</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild className="cursor-pointer rounded-lg">
          <Link href="/me/wallet" className="flex items-center gap-2 py-2">
            <Wallet className="w-4 h-4" />
            <span>Wallet</span>
          </Link>
        </DropdownMenuItem>

        {/* Creator Studio (for creators only) */}
        {isCreator && (
          <>
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider px-2 py-1">
              Creator Studio
            </DropdownMenuLabel>
            <DropdownMenuItem asChild className="cursor-pointer rounded-lg">
              <Link href="/creator/studio" className="flex items-center gap-2 py-2">
                <LayoutDashboard className="w-4 h-4" />
                <span>Dashboard</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="cursor-pointer rounded-lg">
              <Link href="/creator/new-post" className="flex items-center gap-2 py-2">
                <FileText className="w-4 h-4" />
                <span>New Post</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="cursor-pointer rounded-lg">
              <Link href="/creator/studio/earnings" className="flex items-center gap-2 py-2">
                <DollarSign className="w-4 h-4" />
                <span>Earnings</span>
              </Link>
            </DropdownMenuItem>
          </>
        )}

        {/* Become Creator (for fans only) */}
        {!isCreator && (
          <>
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem asChild className="cursor-pointer rounded-lg">
              <Link href="/creator/upgrade" className="flex items-center gap-2 py-2 text-primary">
                <Sparkles className="w-4 h-4" />
                <span className="font-medium">Become a Creator</span>
              </Link>
            </DropdownMenuItem>
          </>
        )}

        <DropdownMenuSeparator className="bg-border" />

        {/* Settings & Sign Out */}
        <DropdownMenuItem asChild className="cursor-pointer rounded-lg">
          <Link href="/settings" className="flex items-center gap-2 py-2">
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem
          className="cursor-pointer rounded-lg text-destructive focus:text-destructive"
          onClick={onSignOut}
        >
          <LogOut className="w-4 h-4 mr-2" />
          <span>Sign Out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
