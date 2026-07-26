"use client";

/**
 * Newsletter email capture (Pre-Payment Alpha).
 * Double opt-in: submitting only triggers a confirmation email.
 */

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail } from "@/lib/icons";
import { Analytics } from "@/lib/analytics";
import { cn } from "@/lib/utils";

interface NewsletterSignupProps {
  /** Attribution for analytics, e.g. "creator_profile", "home_footer". */
  source: string;
  title?: string;
  description?: string;
  className?: string;
}

export function NewsletterSignup({
  source,
  title = "Never miss a drop",
  description = "Get updates about new creators and posts. No spam, unsubscribe anytime.",
  className,
}: NewsletterSignupProps) {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    try {
      setIsSubmitting(true);
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source }),
      });
      const json = await res.json();
      if (json.success) {
        Analytics.track("email_captured", { source });
        setIsDone(true);
      } else {
        toast.error(json.error || "Something went wrong");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isDone) {
    return (
      <div className={cn("card-block p-5 text-center", className)} data-testid="newsletter-success">
        <p className="text-small font-semibold text-text-primary mb-1">Check your inbox</p>
        <p className="text-tiny text-text-tertiary">
          We sent a confirmation link to {email}. Click it to start receiving updates.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("card-block p-5", className)} data-testid="newsletter-signup">
      <div className="flex items-center gap-2 mb-1">
        <Mail size={16} className="text-wine-text" />
        <p className="text-small font-semibold text-text-primary">{title}</p>
      </div>
      <p className="text-tiny text-text-tertiary mb-3">{description}</p>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          type="email"
          required
          placeholder="you@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1"
          aria-label="Email address"
          data-testid="newsletter-email-input"
        />
        <Button
          type="submit"
          disabled={isSubmitting}
          className="shrink-0"
          data-testid="newsletter-submit"
        >
          {isSubmitting ? "…" : "Notify me"}
        </Button>
      </form>
    </div>
  );
}
