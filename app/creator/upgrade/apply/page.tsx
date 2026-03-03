"use client";

import type React from "react";

import { useState } from "react";
import { ArrowLeft, User, FileText, Check } from "@/lib/icons";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";
import { DEFAULT_AVATAR_FAN } from "@/lib/image-fallbacks";

export default function CreatorApplicationPage() {
  const [step, setStep] = useState<"form" | "success">("form");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    displayName: "",
    bio: "",
    category: "",
    socialLinks: "",
    reason: "",
  });

  const currentUser = {
    username: "john_doe",
    role: "fan" as const,
    avatar: DEFAULT_AVATAR_FAN,
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    setTimeout(() => {
      setIsSubmitting(false);
      setStep("success");
    }, 2000);
  };

  if (step === "success") {
    return (
      <PageShell user={currentUser} notificationCount={3} maxWidth="2xl">
        <div className="section-block py-12">
          <div className="card-block p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-6">
              <Check className="w-8 h-8 text-green-500" />
            </div>
            <h1 className="text-3xl font-bold text-text-primary mb-4">Application Submitted!</h1>
            <p className="text-text-secondary mb-8 text-balance">
              Thank you for applying to become a creator. Our team will review your application and
              get back to you within 2-3 business days.
            </p>
            <div className="space-y-3">
              <p className="text-sm text-text-tertiary">Next Steps:</p>
              <div className="text-left space-y-2 bg-surface-raised/50 p-4 rounded-lg">
                {[
                  "We'll review your application",
                  "You'll receive an email with next steps",
                  "Complete KYC verification",
                  "Start creating and earning!",
                ].map((text, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-brand-primary/10 text-brand-primary flex items-center justify-center text-sm font-bold flex-shrink-0">
                      {i + 1}
                    </div>
                    <p className="text-sm text-text-primary">{text}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Button asChild variant="outline" className="flex-1 bg-transparent">
                <Link href="/home">Back to Home</Link>
              </Button>
              <Button
                asChild
                variant="default"
                className="flex-1 text-white shadow-glow hover-bold"
              >
                <Link href="/me">View Profile</Link>
              </Button>
            </div>
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell user={currentUser} notificationCount={3} maxWidth="2xl">
      <div className="section-block py-6">
        <Button asChild variant="ghost" size="sm" className="mb-6">
          <Link href="/creator/upgrade">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Link>
        </Button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-text-primary mb-2">Creator Application</h1>
          <p className="text-text-secondary">
            Tell us about yourself and why you want to become a creator
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="card-block p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-brand-primary/10 text-brand-primary flex items-center justify-center">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-text-primary">Basic Information</h2>
                <p className="text-sm text-text-tertiary">Tell us about your creator profile</p>
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
                <p className="text-xs text-text-tertiary">Minimum 50 characters</p>
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
          </div>

          <div className="card-block p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-brand-primary/10 text-brand-primary flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-text-primary">Additional Details</h2>
                <p className="text-sm text-text-tertiary">Help us understand your goals</p>
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
          </div>

          <div className="card-block p-6 bg-surface-raised/50">
            <h3 className="font-semibold text-text-primary mb-3">What Happens Next?</h3>
            <ul className="space-y-2 text-sm text-text-secondary">
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-brand-primary mt-0.5 flex-shrink-0" />
                <span>Your application will be reviewed within 2-3 business days</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-brand-primary mt-0.5 flex-shrink-0" />
                <span>You&apos;ll receive an email notification with the decision</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-brand-primary mt-0.5 flex-shrink-0" />
                <span>If approved, complete KYC verification to start creating</span>
              </li>
            </ul>
          </div>

          <div className="flex gap-3">
            <Button asChild variant="outline" className="flex-1 bg-transparent">
              <Link href="/creator/upgrade">Cancel</Link>
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              variant="default"
              className="flex-1 text-white shadow-glow hover-bold"
            >
              {isSubmitting ? "Submitting..." : "Submit Application"}
            </Button>
          </div>
        </form>
      </div>
    </PageShell>
  );
}
