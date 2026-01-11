"use client";

import { useEffect, useState } from "react";
import { Lock, Check, X, CreditCard, Loader2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useMediaQuery } from "@/hooks/use-mobile";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getWalletBalance } from "@/lib/wallet";

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
  const isMobile = useMediaQuery("(max-width: 768px)");

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
            setBalanceError("请先登录以查看余额");
          }
          return;
        }

        const wallet = await getWalletBalance(user.id);
        if (!mounted) return;
        setBalance(wallet?.available ?? 0);
      } catch (err) {
        console.error("[PaywallModal] Failed to load wallet balance:", err);
        if (mounted) {
          setBalance(null);
          setBalanceError("无法获取余额");
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
  }, [open, type]);

  const insufficientBalance =
    type === "ppv" && !isBalanceLoading && balance !== null && balance < price;

  const handlePayment = async () => {
    setPaymentState("processing");

    try {
      // 根据类型调用不同的支付逻辑
      if (type === "ppv") {
        // PPV 解锁：调用原子扣费函数
        if (!postId) {
          setPaymentState("error");
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
          setPaymentState("success");
          setTimeout(async () => {
            await onSuccess();
            onOpenChange(false);
            setPaymentState("idle");
          }, 1500);
        } else {
          setPaymentState("error");
          console.error("[PaywallModal] Purchase failed:", result.error);
        }
      } else {
        // 订阅：调用订阅函数
        if (!creatorId) {
          setPaymentState("error");
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
          setPaymentState("success");
          setTimeout(async () => {
            await onSuccess();
            onOpenChange(false);
            setPaymentState("idle");
          }, 1500);
        } else {
          setPaymentState("error");
        }
      }
    } catch (err: any) {
      console.error("[PaywallModal] Payment error:", err);
      setPaymentState("error");
    }
  };

  const handleRetry = () => {
    setPaymentState("idle");
  };

  const handleClose = () => {
    if (paymentState !== "processing") {
      onOpenChange(false);
      setTimeout(() => setPaymentState("idle"), 300);
    }
  };

  const content = (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex flex-col items-center text-center pb-6 border-b border-[#1F1F1F]">
        <div className="w-16 h-16 rounded-full bg-[#6366F1]/10 flex items-center justify-center mb-4">
          {paymentState === "success" ? (
            <Check className="w-8 h-8 text-[#10B981]" />
          ) : paymentState === "error" ? (
            <X className="w-8 h-8 text-[#F43F5E]" />
          ) : (
            <Lock className="w-8 h-8 text-[#6366F1]" />
          )}
        </div>

        {paymentState === "success" ? (
          <>
            <h2 className="text-2xl font-bold text-foreground mb-2">Payment Successful!</h2>
            <p className="text-muted-foreground">Content unlocked. Returning to post...</p>
          </>
        ) : paymentState === "error" ? (
          <>
            <h2 className="text-2xl font-bold text-foreground mb-2">Payment Failed</h2>
            <p className="text-muted-foreground">
              We couldn't process your payment. Please try again.
            </p>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-bold text-foreground mb-2">
              {type === "subscribe" ? `Subscribe to ${creatorName}` : "Unlock This Content"}
            </h2>
            <p className="text-muted-foreground">
              {contentPreview || "Get instant access to exclusive content"}
            </p>
          </>
        )}
      </div>

      {paymentState === "idle" && (
        <>
          {/* Pricing */}
          <div className="py-6 border-b border-[#1F1F1F]">
            <div className="flex items-baseline justify-center gap-2 mb-2">
              <span className="text-4xl font-bold text-foreground">${price.toFixed(2)}</span>
              {type === "subscribe" && (
                <span className="text-muted-foreground">/{billingPeriod}</span>
              )}
            </div>
            {type === "subscribe" && (
              <p className="text-center text-sm text-muted-foreground">
                Billed {billingPeriod}ly, cancel anytime
              </p>
            )}
          </div>

          {/* Benefits */}
          <div className="py-6">
            <h3 className="font-semibold text-foreground mb-4">
              {type === "subscribe" ? "What you'll get:" : "You'll get instant access to:"}
            </h3>
            <ul className="space-y-3">
              {benefits.map((benefit, index) => (
                <li key={index} className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-[#6366F1] flex-shrink-0 mt-0.5" />
                  <span className="text-foreground">{benefit}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Trust indicators - 加密支付安全标识 */}
          <div className="pt-4 pb-6 border-t border-[#1F1F1F]">
            <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-[#10B981]/10 text-[#10B981] rounded-lg border border-[#10B981]/20">
                <Lock className="w-3 h-3" />
                <span className="font-medium">Encrypted Payment</span>
              </div>
              <div className="flex items-center gap-1">
                <CreditCard className="w-3 h-3" />
                <span>Secure checkout</span>
              </div>
              {type === "subscribe" && (
                <div className="flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  <span>Cancel anytime</span>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3">
            {type === "ppv" && (
              <div className="text-center text-xs text-muted-foreground">
                {isBalanceLoading ? (
                  "正在检测钱包余额..."
                ) : balance !== null ? (
                  <>
                    当前余额：${balance.toFixed(2)}
                    {insufficientBalance && (
                      <span className="ml-2">
                        <Link href="/me/wallet" className="text-primary underline">
                          去充值
                        </Link>
                      </span>
                    )}
                  </>
                ) : balanceError ? (
                  balanceError
                ) : (
                  "登录后可查看余额"
                )}
              </div>
            )}
            <Button
              size="lg"
              variant="gradient"
              className="w-full rounded-xl"
              onClick={handlePayment}
              disabled={
                paymentState !== "idle" ||
                (type === "ppv" && (isBalanceLoading || insufficientBalance))
              }
            >
              {type === "subscribe"
                ? `Subscribe for $${price}/${billingPeriod}`
                : insufficientBalance
                  ? "余额不足"
                  : `Unlock for $${price.toFixed(2)}`}
            </Button>
            <Button
              variant="ghost"
              size="lg"
              className="w-full rounded-xl"
              onClick={handleClose}
              disabled={paymentState !== "idle"}
            >
              Maybe later
            </Button>
          </div>
        </>
      )}

      {paymentState === "processing" && (
        <div className="py-12 flex flex-col items-center justify-center gap-4">
          <Loader2 className="w-12 h-12 text-[#6366F1] animate-spin" />
          <p className="text-muted-foreground">Processing your payment...</p>
        </div>
      )}

      {paymentState === "error" && (
        <div className="pt-6 flex flex-col gap-3">
          <Button size="lg" variant="gradient" className="w-full rounded-xl" onClick={handleRetry}>
            Try Again
          </Button>
          <Button variant="ghost" size="lg" className="w-full rounded-xl" onClick={handleClose}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={handleClose}>
        <SheetContent
          side="bottom"
          className="h-[90vh] overflow-y-auto bg-[#0D0D0D] border-t border-[#1F1F1F] rounded-t-3xl"
        >
          {content}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="sm:max-w-md bg-[#0D0D0D] border-[#1F1F1F] rounded-3xl"
        showCloseButton={paymentState !== "processing"}
      >
        {content}
      </DialogContent>
    </Dialog>
  );
}
