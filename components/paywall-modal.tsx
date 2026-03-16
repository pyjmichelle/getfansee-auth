"use client";

import { useEffect, useState } from "react";
import { Lock, Check, X, CreditCard, Loader2 } from "@/lib/icons";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useMediaQuery } from "@/hooks/use-mobile";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getWalletBalance } from "@/lib/wallet";
import { Analytics } from "@/lib/analytics";

interface PaywallModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "subscribe" | "ppv";
  creatorName: string;
  creatorAvatar?: string;
  price: number;
  billingPeriod?: "month" | "year";
  benefits: string[];
  contentPreview?: string;
  postId?: string; // PPV 解锁需要的 post ID
  creatorId?: string; // 订阅需要的 creator ID
  onSuccess: () => void | Promise<void>;
}

export function PaywallModal({
  open,
  onOpenChange,
  type,
  creatorName,
  creatorAvatar,
  price,
  billingPeriod = "month",
  benefits,
  contentPreview,
  postId,
  creatorId,
  onSuccess,
}: PaywallModalProps) {
  const [paymentState, setPaymentState] = useState<"idle" | "processing" | "success" | "error">(
    "idle"
  );
  const [balance, setBalance] = useState<number | null>(null);
  const [isBalanceLoading, setIsBalanceLoading] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const isMobile = useMediaQuery("(max-width: 768px)");
  const isTestMode =
    process.env.NEXT_PUBLIC_TEST_MODE === "true" || process.env.PLAYWRIGHT_TEST_MODE === "true";

  // 当弹窗打开时追踪 paywall 展示事件
  useEffect(() => {
    if (open && postId) {
      Analytics.paywallShown(
        postId,
        type === "subscribe" ? "subscription" : "ppv",
        Math.round(price * 100)
      );
    }
  }, [open, postId, type, price]);

  useEffect(() => {
    let mounted = true;

    const fetchBalance = async () => {
      if (!open || type !== "ppv") {
        setBalance(null);
        setBalanceError(null);
        return;
      }

      setIsBalanceLoading(true);
      setBalanceError(null);

      try {
        const user = await getCurrentUser();
        if (!user) {
          if (mounted) {
            setBalance(null);
            setBalanceError("Please sign in to view balance");
          }
          return;
        }

        const wallet = await getWalletBalance(user.id);
        if (!mounted) return;
        const available = wallet?.available ?? 0;
        setBalance(available);
      } catch (err) {
        console.error("[PaywallModal] Failed to load wallet balance:", err);
        if (mounted) {
          setBalance(null);
          setBalanceError("Unable to load balance");
        }
      } finally {
        if (mounted) {
          setIsBalanceLoading(false);
        }
      }
    };

    fetchBalance();

    return () => {
      mounted = false;
    };
  }, [open, type, price, isTestMode]);

  const insufficientBalance =
    type === "ppv" && !isBalanceLoading && balance !== null && balance < price;

  const handleRetryBalance = async () => {
    setBalanceError(null);
    setIsBalanceLoading(true);
    try {
      const user = await getCurrentUser();
      if (!user) {
        setBalanceError("Please sign in to view balance");
        return;
      }
      const wallet = await getWalletBalance(user.id);
      setBalance(wallet?.available ?? 0);
    } catch {
      setBalanceError("Unable to load balance");
    } finally {
      setIsBalanceLoading(false);
    }
  };

  const handlePayment = async () => {
    setPaymentError(null);
    setPaymentState("processing");

    // 追踪付费意图事件
    if (postId) {
      Analytics.contentUnlockAttempted(
        postId,
        type === "subscribe" ? "subscription" : "ppv",
        Math.round(price * 100)
      );
    }

    try {
      if (isTestMode) {
        setPaymentState("success");
        setTimeout(async () => {
          await onSuccess();
          onOpenChange(false);
          setPaymentState("idle");
        }, 300);
        return;
      }

      // 根据类型调用不同的支付逻辑
      if (type === "ppv") {
        // PPV 解锁：调用原子扣费函数
        if (!postId) {
          setPaymentState("error");
          setPaymentError("Missing post information. Please refresh and try again.");
          console.error("[PaywallModal] postId is required for PPV unlock");
          return;
        }

        const response = await fetch("/api/unlock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postId, priceCents: price * 100 }),
        });
        const result = await response.json();

        if (result.success) {
          Analytics.contentUnlocked(postId, "ppv", Math.round(price * 100));
          setPaymentState("success");
          setTimeout(async () => {
            await onSuccess();
            onOpenChange(false);
            setPaymentState("idle");
          }, 1500);
        } else {
          setPaymentState("error");
          setPaymentError(result.error || "Payment failed. Please try again.");
          console.error("[PaywallModal] Purchase failed:", result.error);
        }
      } else {
        // 订阅：调用订阅函数
        if (!creatorId) {
          setPaymentState("error");
          setPaymentError("Missing creator information. Please refresh and try again.");
          console.error("[PaywallModal] creatorId is required for subscription");
          return;
        }

        const response = await fetch("/api/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ creatorId }),
        });
        const data = await response.json();

        if (data.success) {
          Analytics.subscriptionStarted(creatorId, Math.round(price * 100));
          if (postId) {
            Analytics.contentUnlocked(postId, "subscription", Math.round(price * 100));
          }
          setPaymentState("success");
          setTimeout(async () => {
            await onSuccess();
            onOpenChange(false);
            setPaymentState("idle");
          }, 1500);
        } else {
          setPaymentState("error");
          setPaymentError(data.error || "Subscription failed. Please try again.");
        }
      }
    } catch (err: unknown) {
      console.error("[PaywallModal] Payment error:", err);
      setPaymentError(err instanceof Error ? err.message : "Payment failed. Please try again.");
      setPaymentState("error");
    }
  };

  const handleRetry = () => {
    setPaymentError(null);
    setPaymentState("idle");
  };

  const handleClose = () => {
    if (paymentState !== "processing") {
      onOpenChange(false);
      setTimeout(() => setPaymentState("idle"), 300);
    }
  };

  const content = (
    <div className="flex flex-col" data-testid="paywall-modal">
      {/* Header */}
      <div
        className="flex flex-col items-center text-center pb-4 border-b border-white/8"
        data-testid="paywall-modal-header"
      >
        {/* Creator avatar with lock badge overlay */}
        <div className="relative mb-3">
          {creatorAvatar && paymentState === "idle" ? (
            <div className="relative">
              <img
                src={creatorAvatar}
                alt={creatorName}
                className="size-14 rounded-full object-cover border-2 border-violet-500/30 shadow-glow-violet"
              />
              <div className="absolute -bottom-1 -right-1 size-6 rounded-full bg-bg-elevated border border-white/10 flex items-center justify-center">
                <Lock className="size-3 text-violet-400" aria-hidden="true" />
              </div>
            </div>
          ) : (
            <div className="size-14 rounded-full bg-violet-500/15 backdrop-blur-md flex items-center justify-center border border-violet-500/20 shadow-glow-violet">
              {paymentState === "success" ? (
                <Check className="size-6 text-emerald-400" aria-hidden="true" />
              ) : paymentState === "error" ? (
                <X className="size-6 text-red-400" aria-hidden="true" />
              ) : (
                <Lock className="size-6 text-violet-400" aria-hidden="true" />
              )}
            </div>
          )}
        </div>

        {paymentState === "success" ? (
          <>
            <DialogTitle
              className="text-[18px] font-semibold text-white mb-1"
              data-testid="paywall-success-message"
            >
              Content Unlocked!
            </DialogTitle>
            <DialogDescription className="text-text-muted text-[12px] text-center">
              Enjoy your exclusive content...
            </DialogDescription>
          </>
        ) : paymentState === "error" ? (
          <>
            <DialogTitle className="text-[18px] font-semibold text-white mb-1">
              Payment Failed
            </DialogTitle>
            <DialogDescription className="text-text-muted text-[12px]">
              {paymentError ||
                "Something went wrong. Please check your payment method and try again."}
            </DialogDescription>
          </>
        ) : (
          <>
            <DialogTitle className="text-[18px] font-semibold text-white mb-1">
              {type === "subscribe" ? `Subscribe to ${creatorName}` : "Unlock Exclusive Content"}
            </DialogTitle>
            <DialogDescription className="text-text-muted text-[12px]">
              {contentPreview || "Get instant access to exclusive content"}
            </DialogDescription>
          </>
        )}
      </div>

      {paymentState === "idle" && (
        <>
          {/* Pricing */}
          <div className="py-4 border-b border-white/6 text-center">
            <div className="flex items-baseline justify-center gap-1.5 mb-1">
              <span
                className="text-[32px] font-bold text-gradient-primary"
                data-testid="paywall-price"
              >
                ${price.toFixed(2)}
              </span>
              {type === "subscribe" && (
                <span className="text-text-muted text-[13px]" data-testid="paywall-billing-period">
                  /{billingPeriod}
                </span>
              )}
            </div>
            {type === "subscribe" && (
              <p className="text-[12px] text-text-muted">
                Billed {billingPeriod}ly · Cancel anytime
              </p>
            )}
          </div>

          {/* Benefits */}
          <div className="py-4">
            <p className="text-[12px] font-semibold text-text-secondary mb-2.5">
              {type === "subscribe" ? "What's included:" : "Instant access to:"}
            </p>
            <ul className="space-y-2">
              {benefits.map((benefit, index) => (
                <li key={index} className="flex items-start gap-2">
                  <Check
                    className="size-[13px] text-violet-400 shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <span className="text-text-secondary text-[13px]">{benefit}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Payment method — wallet for PPV, wallet/card for subscribe */}
          <div className="py-3 border-b border-white/6">
            <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-[var(--radius-sm)] bg-white/4 border border-white/8">
              <div className="size-8 rounded-lg bg-violet-500/15 flex items-center justify-center shrink-0">
                <CreditCard className="size-[14px] text-violet-400" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-text-primary leading-tight">
                  {type === "subscribe" ? "Charged to your account" : "GetFanSee Wallet"}
                </p>
                <p className="text-[11px] text-text-muted leading-tight">
                  {type === "subscribe"
                    ? "Billed monthly · Cancel anytime"
                    : "Balance will be deducted at checkout"}
                </p>
              </div>
            </div>
          </div>

          {/* Trust indicators */}
          <div className="py-3 border-t border-white/6">
            <div className="flex flex-wrap items-center justify-center gap-3 text-[11px] text-text-muted">
              <div className="flex items-center gap-1 text-emerald-400">
                <Lock className="size-[11px]" aria-hidden="true" />
                <span>Secure &amp; Encrypted</span>
              </div>
              <div className="flex items-center gap-1">
                <CreditCard className="size-[11px]" aria-hidden="true" />
                <span>Encrypted payment</span>
              </div>
              {type === "subscribe" && (
                <div className="flex items-center gap-1">
                  <Check className="size-[11px]" aria-hidden="true" />
                  <span>Cancel anytime</span>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-2">
            {type === "ppv" && (
              <div className="text-center text-[12px] text-text-muted mb-1">
                {isBalanceLoading ? (
                  <span
                    className="flex items-center justify-center gap-1.5"
                    data-testid="paywall-balance-loading"
                  >
                    <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                    Checking balance...
                  </span>
                ) : balance !== null ? (
                  <>
                    <span data-testid="paywall-balance-value">Balance: ${balance.toFixed(2)}</span>
                    {insufficientBalance && (
                      <span
                        className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-[var(--radius-xs)] bg-red-500/10 text-red-400 text-[11px] font-medium"
                        data-testid="paywall-balance-insufficient"
                      >
                        Low balance —{" "}
                        <Link
                          href="/me/wallet"
                          data-testid="paywall-add-funds-link"
                          className="underline hover:text-red-300 transition-colors font-semibold"
                          aria-label="Go to wallet to add funds"
                        >
                          Add funds
                        </Link>
                      </span>
                    )}
                  </>
                ) : balanceError ? (
                  <span
                    className="flex items-center gap-2 text-red-400"
                    data-testid="paywall-balance-error"
                  >
                    {balanceError}
                    {balanceError !== "Please sign in to view balance" && (
                      <button
                        type="button"
                        className="text-xs underline transition-colors hover:text-red-300"
                        onClick={handleRetryBalance}
                        data-testid="paywall-balance-retry"
                      >
                        Retry
                      </button>
                    )}
                  </span>
                ) : (
                  <span data-testid="paywall-balance-empty">Sign in to see balance</span>
                )}
              </div>
            )}
            <Button
              data-testid={
                type === "subscribe" ? "paywall-subscribe-button" : "paywall-unlock-button"
              }
              size="lg"
              variant={type === "subscribe" ? "violet" : "gold"}
              className="w-full"
              onClick={handlePayment}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  if (
                    paymentState === "idle" &&
                    !(type === "ppv" && (isBalanceLoading || insufficientBalance))
                  ) {
                    handlePayment();
                  }
                }
              }}
              disabled={
                paymentState !== "idle" ||
                (type === "ppv" && (isBalanceLoading || insufficientBalance))
              }
              aria-label={
                type === "subscribe"
                  ? `Subscribe for $${price.toFixed(2)} per ${billingPeriod}`
                  : `Unlock content for $${price.toFixed(2)}`
              }
            >
              {type === "subscribe"
                ? `Subscribe · $${price.toFixed(2)}/${billingPeriod}`
                : insufficientBalance
                  ? "Insufficient balance"
                  : `Unlock for $${price.toFixed(2)}`}
            </Button>
            <Button
              variant="ghost"
              size="default"
              className="w-full"
              onClick={handleClose}
              disabled={paymentState !== "idle"}
              aria-label="Close payment modal"
            >
              Maybe later
            </Button>
          </div>
        </>
      )}

      {paymentState === "processing" && (
        <div
          className="py-10 flex flex-col items-center justify-center gap-3 animate-fade-in"
          role="status"
          aria-live="polite"
          data-testid="paywall-processing"
        >
          <div className="size-14 rounded-full bg-violet-500/10 flex items-center justify-center border border-violet-500/20 shadow-glow-violet">
            <Loader2 className="size-6 text-violet-400 animate-spin" aria-hidden="true" />
          </div>
          <p className="text-text-muted text-[13px] font-medium">Processing payment...</p>
          <p className="text-text-disabled text-[12px]">Please wait, do not close this window</p>
        </div>
      )}

      {paymentState === "error" && (
        <div className="pt-4 flex flex-col gap-2" data-testid="paywall-error">
          <Button
            data-testid="paywall-retry-button"
            size="lg"
            variant="violet"
            className="w-full"
            onClick={handleRetry}
            aria-label="Try payment again"
          >
            Try Again
          </Button>
          <Button
            variant="ghost"
            size="default"
            className="w-full"
            onClick={handleClose}
            aria-label="Cancel payment"
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <Sheet
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            handleClose();
            return;
          }
          onOpenChange(true);
        }}
      >
        <SheetContent
          side="bottom"
          className="max-h-[85vh] overflow-y-auto px-5 py-4 rounded-t-[var(--radius-lg)]"
        >
          {content}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="sm:max-w-[400px] p-5"
        showCloseButton={paymentState !== "processing"}
        onPointerDownOutside={(event) => {
          if (paymentState !== "idle") {
            event.preventDefault();
          }
        }}
        onEscapeKeyDown={(event) => {
          if (paymentState !== "idle") {
            event.preventDefault();
          }
        }}
      >
        {content}
      </DialogContent>
    </Dialog>
  );
}
