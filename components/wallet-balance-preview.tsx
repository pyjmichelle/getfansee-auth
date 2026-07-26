"use client";

import { useState } from "react";
import { Wallet, Plus } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useWalletBalance } from "@/hooks/use-wallet-balance";
import { formatUsdFromDollars } from "@/lib/format";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface WalletBalancePreviewProps {
  className?: string;
}

export function WalletBalancePreview({ className }: WalletBalancePreviewProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { balanceDollars, isLoading } = useWalletBalance();
  const balanceDisplay = formatUsdFromDollars(balanceDollars);

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          className={`w-full justify-start gap-3 h-auto py-3 px-4 hover:bg-brand-primary/5 active:scale-[0.98] transition-all focus-visible:ring-2 focus-visible:ring-brand-primary min-h-[56px] ${className}`}
          aria-label={`Wallet balance: ${balanceDisplay}. Click to add funds.`}
        >
          <div className="w-10 h-10 rounded-lg bg-brand-accent/10 flex items-center justify-center shrink-0">
            <Wallet className="w-5 h-5 text-brand-accent" aria-hidden="true" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-tiny text-text-tertiary">Wallet Balance</p>
            {isLoading ? (
              <Skeleton className="h-5 w-20 mt-0.5" />
            ) : (
              <p className="text-lg font-bold text-text-primary">{balanceDisplay}</p>
            )}
          </div>
          <Plus className="w-4 h-4 text-text-tertiary shrink-0" aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-surface-base border-border-base text-text-primary">
        <DialogHeader>
          <DialogTitle className="text-text-primary">Wallet top-ups coming soon</DialogTitle>
          <DialogDescription className="text-text-tertiary">
            In-platform purchases are not yet enabled during the Alpha. You can still discover and
            follow creators for free, and support them through the verified links on their profiles.
          </DialogDescription>
        </DialogHeader>
        <p className="text-tiny text-text-tertiary">
          Payments launch in Beta — active Alpha members will receive Founding Fan perks, including
          wallet credit, when payments go live.
        </p>
        <Button className="w-full min-h-[44px]" onClick={() => setIsDialogOpen(false)}>
          Got it
        </Button>
      </DialogContent>
    </Dialog>
  );
}
