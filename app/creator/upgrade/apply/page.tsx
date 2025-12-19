"use client"

import type React from "react"

import { useState } from "react"
import { ArrowLeft, User, FileText, Check } from "lucide-react"
import { NavHeader } from "@/components/nav-header"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import Link from "next/link"

export default function CreatorApplicationPage() {
  const [step, setStep] = useState<"form" | "success">("form")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    displayName: "",
    bio: "",
    category: "",
    socialLinks: "",
    reason: "",
  })

  const currentUser = {
    username: "john_doe",
    role: "fan" as const,
    avatar: "/placeholder.svg?height=100&width=100",
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    // Simulate API call
    setTimeout(() => {
      setIsSubmitting(false)
      setStep("success")
    }, 2000)
  }

  if (step === "success") {
    return (
      <div className="min-h-screen bg-background">
        <NavHeader user={currentUser} notificationCount={3} />

        <main className="container max-w-2xl mx-auto px-4 py-12">
          <Card className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-6">
              <Check className="w-8 h-8 text-green-500" />
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-4">Application Submitted!</h1>
            <p className="text-muted-foreground mb-8 text-balance">
              Thank you for applying to become a creator. Our team will review your application and get back to you
              within 2-3 business days.
            </p>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Next Steps:</p>
              <div className="text-left space-y-2 bg-muted/50 p-4 rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold flex-shrink-0">
                    1
                  </div>
                  <p className="text-sm text-foreground">We'll review your application</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold flex-shrink-0">
                    2
                  </div>
                  <p className="text-sm text-foreground">You'll receive an email with next steps</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold flex-shrink-0">
                    3
                  </div>
                  <p className="text-sm text-foreground">Complete KYC verification</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold flex-shrink-0">
                    4
                  </div>
                  <p className="text-sm text-foreground">Start creating and earning!</p>
                </div>
              </div>
            </div>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Button asChild variant="outline" className="flex-1 bg-transparent">
                <Link href="/home">Back to Home</Link>
              </Button>
              <Button asChild className="flex-1">
                <Link href="/me">View Profile</Link>
              </Button>
            </div>
          </Card>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <NavHeader user={currentUser} notificationCount={3} />

      <main className="container max-w-2xl mx-auto px-4 py-6">
        <Button asChild variant="ghost" size="sm" className="mb-6">
          <Link href="/creator/upgrade">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Link>
        </Button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Creator Application</h1>
          <p className="text-muted-foreground">Tell us about yourself and why you want to become a creator</p>
        </div>

        <form onSubmit={handleSubmit}>
          <Card className="p-6 mb-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Basic Information</h2>
                <p className="text-sm text-muted-foreground">Tell us about your creator profile</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name *</Label>
                <Input
                  id="displayName"
                  placeholder="How you want to be known"
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  required
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Bio *</Label>
                <Textarea
                  id="bio"
                  placeholder="Tell your audience about yourself..."
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  required
                  className="min-h-[100px] resize-none"
                />
                <p className="text-xs text-muted-foreground">Minimum 50 characters</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Content Category *</Label>
                <Input
                  id="category"
                  placeholder="e.g., Art, Fitness, Gaming, Education"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  required
                  className="h-11"
                />
              </div>
            </div>
          </Card>

          <Card className="p-6 mb-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Additional Details</h2>
                <p className="text-sm text-muted-foreground">Help us understand your goals</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="socialLinks">Social Media Links (Optional)</Label>
                <Textarea
                  id="socialLinks"
                  placeholder="Your existing social media profiles (one per line)"
                  value={formData.socialLinks}
                  onChange={(e) => setFormData({ ...formData, socialLinks: e.target.value })}
                  className="min-h-[80px] resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason">Why do you want to become a creator? *</Label>
                <Textarea
                  id="reason"
                  placeholder="Share your motivation and goals..."
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  required
                  className="min-h-[120px] resize-none"
                />
              </div>
            </div>
          </Card>

          <Card className="p-6 mb-6 bg-muted/50">
            <h3 className="font-semibold text-foreground mb-3">What Happens Next?</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <span>Your application will be reviewed within 2-3 business days</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <span>You'll receive an email notification with the decision</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <span>If approved, complete KYC verification to start creating</span>
              </li>
            </ul>
          </Card>

          <div className="flex gap-3">
            <Button asChild variant="outline" className="flex-1 bg-transparent">
              <Link href="/creator/upgrade">Cancel</Link>
            </Button>
            <Button type="submit" disabled={isSubmitting} className="flex-1">
              {isSubmitting ? "Submitting..." : "Submit Application"}
            </Button>
          </div>
        </form>
      </main>
    </div>
  )
}
