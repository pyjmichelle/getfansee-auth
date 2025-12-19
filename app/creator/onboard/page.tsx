"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { User, DollarSign, Check, ArrowRight } from "lucide-react"
import { NavHeader } from "@/components/nav-header"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

export default function CreatorOnboardPage() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2>(1)
  const [username, setUsername] = useState("")
  const [bio, setBio] = useState("")
  const [subscriptionPrice, setSubscriptionPrice] = useState("9.99")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleContinue = () => {
    if (step === 1) {
      setStep(2)
    } else {
      setIsSubmitting(true)
      setTimeout(() => {
        router.push("/creator/studio")
      }, 1500)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <NavHeader
        user={{
          username: username || "new_creator",
          role: "creator",
        }}
      />

      <main className="container max-w-2xl mx-auto px-4 py-12">
        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className={`w-3 h-3 rounded-full ${step >= 1 ? "bg-primary" : "bg-muted"}`} />
          <div className="w-12 h-0.5 bg-muted" />
          <div className={`w-3 h-3 rounded-full ${step >= 2 ? "bg-primary" : "bg-muted"}`} />
        </div>

        <Card className="p-8">
          {step === 1 ? (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <User className="w-8 h-8 text-primary" />
                </div>
                <h1 className="text-2xl font-bold text-foreground mb-2">Create Your Profile</h1>
                <p className="text-muted-foreground">Let fans know who you are</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username *</Label>
                  <Input
                    id="username"
                    placeholder="your_username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">Bio *</Label>
                  <Textarea
                    id="bio"
                    placeholder="Tell your fans what kind of content you create..."
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    required
                    className="min-h-[120px] resize-none"
                  />
                  <p className="text-xs text-muted-foreground">{bio.length}/200</p>
                </div>

                {/* Preview */}
                <div className="border border-border rounded-lg p-4 bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-3">Preview:</p>
                  <div className="flex items-start gap-3">
                    <Avatar className="w-12 h-12">
                      <AvatarFallback>{username ? username[0].toUpperCase() : "U"}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold text-foreground">{username || "your_username"}</p>
                      <p className="text-sm text-muted-foreground mt-1">{bio || "Your bio will appear here..."}</p>
                    </div>
                  </div>
                </div>
              </div>

              <Button size="lg" className="w-full" onClick={handleContinue} disabled={!username || !bio}>
                Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <DollarSign className="w-8 h-8 text-primary" />
                </div>
                <h1 className="text-2xl font-bold text-foreground mb-2">Set Your Subscription Price</h1>
                <p className="text-muted-foreground">You can always change this later</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Monthly Subscription Price (USD) *</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      id="price"
                      type="number"
                      placeholder="9.99"
                      value={subscriptionPrice}
                      onChange={(e) => setSubscriptionPrice(e.target.value)}
                      required
                      min="1"
                      step="0.01"
                      className="pl-8"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Recommended range: $5 - $25 per month</p>
                </div>

                {/* Earnings Preview */}
                <div className="border border-border rounded-lg p-4 bg-muted/30 space-y-3">
                  <p className="text-xs text-muted-foreground">Estimated monthly earnings:</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">10 subscribers</span>
                      <span className="font-semibold text-foreground">
                        ${(Number.parseFloat(subscriptionPrice || "0") * 10).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">50 subscribers</span>
                      <span className="font-semibold text-foreground">
                        ${(Number.parseFloat(subscriptionPrice || "0") * 50).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">100 subscribers</span>
                      <span className="font-semibold text-primary">
                        ${(Number.parseFloat(subscriptionPrice || "0") * 100).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-semibold text-foreground mb-1">You keep 90% of earnings</p>
                      <p className="text-muted-foreground">Platform fee is 10%. Payouts are processed monthly.</p>
                    </div>
                  </div>
                </div>
              </div>

              <Button
                size="lg"
                className="w-full"
                onClick={handleContinue}
                disabled={!subscriptionPrice || isSubmitting}
              >
                {isSubmitting ? "Setting up your profile..." : "Complete Setup"}
              </Button>
            </div>
          )}
        </Card>
      </main>
    </div>
  )
}
