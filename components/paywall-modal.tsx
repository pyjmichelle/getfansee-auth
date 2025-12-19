"use client"

import { useState } from "react"
import { Lock, Check, X, CreditCard, Loader2 } from "lucide-react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { useMediaQuery } from "@/hooks/use-mobile"

interface PaywallModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  type: "subscribe" | "ppv"
  creatorName: string
  creatorAvatar?: string
  price: number
  billingPeriod?: "month" | "year"
  benefits: string[]
  contentPreview?: string
  onSuccess: () => void
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
  onSuccess,
}: PaywallModalProps) {
  const [paymentState, setPaymentState] = useState<"idle" | "processing" | "success" | "error">("idle")
  const isMobile = useMediaQuery("(max-width: 768px)")

  const handlePayment = async () => {
    setPaymentState("processing")

    // Simulate payment processing
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Simulate random success/failure for demo
    const success = Math.random() > 0.1

    if (success) {
      setPaymentState("success")
      setTimeout(() => {
        onSuccess()
        onOpenChange(false)
        setPaymentState("idle")
      }, 1500)
    } else {
      setPaymentState("error")
    }
  }

  const handleRetry = () => {
    setPaymentState("idle")
  }

  const handleClose = () => {
    if (paymentState !== "processing") {
      onOpenChange(false)
      setTimeout(() => setPaymentState("idle"), 300)
    }
  }

  const content = (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex flex-col items-center text-center pb-6 border-b border-border">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          {paymentState === "success" ? (
            <Check className="w-8 h-8 text-green-500" />
          ) : paymentState === "error" ? (
            <X className="w-8 h-8 text-red-500" />
          ) : (
            <Lock className="w-8 h-8 text-primary" />
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
            <p className="text-muted-foreground">We couldn't process your payment. Please try again.</p>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-bold text-foreground mb-2">
              {type === "subscribe" ? `Subscribe to ${creatorName}` : "Unlock This Content"}
            </h2>
            <p className="text-muted-foreground">{contentPreview || "Get instant access to exclusive content"}</p>
          </>
        )}
      </div>

      {paymentState === "idle" && (
        <>
          {/* Pricing */}
          <div className="py-6 border-b border-border">
            <div className="flex items-baseline justify-center gap-2 mb-2">
              <span className="text-4xl font-bold text-foreground">${price.toFixed(2)}</span>
              {type === "subscribe" && <span className="text-muted-foreground">/{billingPeriod}</span>}
            </div>
            {type === "subscribe" && (
              <p className="text-center text-sm text-muted-foreground">Billed {billingPeriod}ly, cancel anytime</p>
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
                  <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-foreground">{benefit}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Trust indicators */}
          <div className="pt-4 pb-6 border-t border-border">
            <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Lock className="w-3 h-3" />
                <span>Secure payment</span>
              </div>
              <div className="flex items-center gap-1">
                <CreditCard className="w-3 h-3" />
                <span>Encrypted checkout</span>
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
            <Button size="lg" className="w-full" onClick={handlePayment} disabled={paymentState === "processing"}>
              {type === "subscribe" ? `Subscribe for $${price}/${billingPeriod}` : `Unlock for $${price}`}
            </Button>
            <Button
              variant="ghost"
              size="lg"
              className="w-full"
              onClick={handleClose}
              disabled={paymentState === "processing"}
            >
              Maybe later
            </Button>
          </div>
        </>
      )}

      {paymentState === "processing" && (
        <div className="py-12 flex flex-col items-center justify-center gap-4">
          <Loader2 className="w-12 h-12 text-primary animate-spin" />
          <p className="text-muted-foreground">Processing your payment...</p>
        </div>
      )}

      {paymentState === "error" && (
        <div className="pt-6 flex flex-col gap-3">
          <Button size="lg" className="w-full" onClick={handleRetry}>
            Try Again
          </Button>
          <Button variant="ghost" size="lg" className="w-full" onClick={handleClose}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  )

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={handleClose}>
        <SheetContent side="bottom" className="h-[90vh] overflow-y-auto">
          {content}
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md" showCloseButton={paymentState !== "processing"}>
        {content}
      </DialogContent>
    </Dialog>
  )
}
