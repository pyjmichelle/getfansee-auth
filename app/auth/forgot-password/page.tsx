"use client";

import type React from "react";
import { useState } from "react";
import { Mail, ArrowLeft } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

const supabase = getSupabaseBrowserClient();

export default function ForgotPasswordPage() {
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
      const siteUrl =
        process.env.NEXT_PUBLIC_SITE_URL ||
        process.env.NEXT_PUBLIC_BASE_URL ||
        (typeof window !== "undefined" ? window.location.origin : undefined);
      const redirectTo = siteUrl ? `${siteUrl}/auth/reset-password` : undefined;

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });

      if (resetError) {
        throw resetError;
      }

      setSent(true);
    } catch (err: unknown) {
      console.error("[forgot-password] Error:", err);
      const message =
        err instanceof Error ? err.message : "Failed to send reset email. Please try again.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="w-full max-w-md">
          <div className="card-block p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-brand-primary-alpha-10 flex items-center justify-center mx-auto mb-6">
              <Mail className="w-8 h-8 text-brand-primary" />
            </div>
            <h1 className="text-2xl font-semibold text-text-primary mb-3">Check your email</h1>
            <p className="text-text-tertiary mb-2">
              We&apos;ve sent a password reset link to{" "}
              <strong className="text-text-primary">{email}</strong>
            </p>
            <p className="text-sm text-text-tertiary mb-6">
              Click the link in the email to reset your password. The link will expire in 1 hour.
            </p>
            <div className="space-y-3">
              {email.toLowerCase().endsWith("@gmail.com") && (
                <Button
                  onClick={() => {
                    window.open("https://mail.google.com", "_blank");
                  }}
                  className="w-full"
                >
                  Open Gmail
                </Button>
              )}
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
        <div className="card-block p-8">
          <div className="mb-6">
            <Button asChild variant="ghost" size="sm" className="-ml-3 mb-4">
              <Link href="/auth">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Link>
            </Button>
            <h1 className="text-2xl font-semibold text-text-primary text-balance">
              Reset your password
            </h1>
            <p className="text-text-tertiary mt-2">
              Enter your email address and we&apos;ll send you a link to reset your password.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-error/10 border border-error/20 text-error text-sm px-4 py-3 rounded-md">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-text-primary">
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
                autoComplete="email"
              />
            </div>

            <Button type="submit" className="w-full h-11" disabled={isLoading}>
              {isLoading ? "Sending..." : "Send Reset Link"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
