"use client";

import type React from "react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Mail, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

const supabase = getSupabaseBrowserClient();

export default function ResendVerificationPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    if (!email || !email.includes("@")) {
      setError("Please enter a valid email address");
      setIsLoading(false);
      return;
    }

    try {
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo:
            typeof window !== "undefined" ? `${window.location.origin}/auth/verify` : undefined,
        },
      });

      if (resendError) {
        throw resendError;
      }

      setIsLoading(false);
      setSent(true);
    } catch (err: unknown) {
      console.error("[resend] Error:", err);
      const message =
        err instanceof Error ? err.message : "Failed to send verification email. Please try again.";
      setError(message);
      setIsLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="w-full max-w-md">
          <div className="bg-card border border-border rounded-lg p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <Mail className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-semibold text-foreground mb-3">Check your email</h1>
            <p className="text-muted-foreground mb-2">
              We've sent a verification link to <strong className="text-foreground">{email}</strong>
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              Click the link in the email to verify your account. The link will expire in 24 hours.
            </p>
            <div className="space-y-3">
              <Button
                onClick={() => {
                  window.open("https://mail.google.com", "_blank");
                  setTimeout(() => {
                    router.push("/auth/verify");
                  }, 1000);
                }}
                className="w-full"
              >
                Open Gmail / I've confirmed
              </Button>
              <Button asChild variant="outline" className="w-full bg-transparent">
                <Link href="/auth">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Login
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md">
        <div className="bg-card border border-border rounded-lg p-8">
          <div className="mb-6">
            <Button asChild variant="ghost" size="sm" className="-ml-3 mb-4">
              <Link href="/auth">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Link>
            </Button>
            <h1 className="text-2xl font-semibold text-foreground text-balance">
              Resend Verification Email
            </h1>
            <p className="text-muted-foreground mt-2">
              Enter your email address and we'll send you a new verification link.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm px-4 py-3 rounded-md">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11"
                disabled={isLoading}
              />
            </div>

            <Button type="submit" className="w-full h-11" disabled={isLoading}>
              {isLoading ? "Sending..." : "Send Verification Email"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
