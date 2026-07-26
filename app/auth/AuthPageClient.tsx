"use client";

import type React from "react";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { ensureProfile, signInWithGoogle, signUpWithEmail } from "@/lib/auth";
import { captureReferralFromUrl } from "@/lib/referral";
import { Analytics } from "@/lib/analytics";
import { AlertCircle, Eye, EyeOff, DollarSign, Lock, Globe, Sparkles } from "@/lib/icons";
import { TrustStrip } from "@/components/trust-strip";

type AuthPageClientProps = {
  initialMode?: "login" | "signup";
  isInvited?: boolean;
  refName?: string;
  /** Deep-link target from middleware's `?redirect=`; falls back to /home. */
  redirectTo?: string;
};

/**
 * Only ever navigate to a same-origin, relative path — `redirectTo` is
 * attacker-controlled query-string input echoed back into a client-side
 * navigation, so reject anything that isn't a plain in-app path (blocks
 * protocol-relative `//evil.com`, absolute URLs, and redirect-back-to-/auth
 * loops).
 */
function sanitizeRedirectTarget(path: string | undefined): string {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return "/home";
  if (path.startsWith("/auth")) return "/home";
  return path;
}

/**
 * Navigate after a successful sign-in/sign-up.
 *
 * `router.refresh()` immediately followed by `router.push()` is a known race
 * in the App Router: `refresh()` only *schedules* a server re-fetch to
 * invalidate the client router cache, it doesn't block until that lands. If
 * `push()` runs in the same tick, it can navigate using the STALE cached
 * root layout — which still holds the pre-login `initialAuth` — so `/home`
 * briefly (or, depending on cache timing, not-so-briefly) renders as if
 * logged out, and NavHeader/redirect guards on the destination page can
 * bounce the user right back to /auth even though sign-in succeeded.
 *
 * A full navigation sidesteps the client router cache entirely: the browser
 * requests `target` fresh, the server reads the just-set auth cookie, and
 * every layout down the tree renders with correct auth state on the very
 * first paint. Auth transitions are infrequent enough that losing the SPA
 * transition here is the right trade for eliminating this whole race class.
 */
function navigateAfterAuth(target: string) {
  window.location.href = target;
}

const devLog = (...args: unknown[]) => {
  if (process.env.NODE_ENV === "development") {
    console.warn(...args);
  }
};

const getErrorMessage = (error: unknown, fallback = "Internal server error") =>
  error instanceof Error ? error.message : fallback;

export default function AuthPageClient({
  initialMode = "login",
  isInvited = false,
  refName,
  redirectTo,
}: AuthPageClientProps) {
  const supabase = getSupabaseBrowserClient();
  const isTestMode = process.env.NEXT_PUBLIC_TEST_MODE === "true";
  const postAuthTarget = sanitizeRedirectTarget(redirectTo);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  // If arriving via a referral invite, default to the signup tab
  const [activeTab, setActiveTab] = useState<"login" | "signup">(
    isInvited ? "signup" : initialMode
  );
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);

  const resetAuthState = useCallback(() => {
    setError(null);
    setInfo(null);
    setLoginEmail("");
    setLoginPassword("");
    setSignupEmail("");
    setSignupPassword("");
    setAgeConfirmed(false);
    setShowLoginPassword(false);
    setShowSignupPassword(false);
  }, []);

  useEffect(() => {
    setActiveTab(initialMode);
    resetAuthState();
  }, [initialMode, resetAuthState]);

  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("mode", activeTab);
      window.history.replaceState(null, "", url.toString());
    } catch (err) {
      devLog("[auth] Failed to sync tab mode to URL", err);
    }
  }, [activeTab]);

  const handleTabChange = (value: string) => {
    if (value === "login" || value === "signup") {
      setActiveTab(value);
      resetAuthState();
    }
  };

  useEffect(() => {
    captureReferralFromUrl();
  }, []);

  const validateEmailPassword = (email: string, password: string) => {
    if (!email || !password) {
      return "All fields are required";
    }
    if (!email.includes("@") || !email.includes(".")) {
      return "Please enter a valid email address";
    }
    if (password.length < 8) {
      return "Password must be at least 8 characters long";
    }
    return null;
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setIsLoading(true);

    const validationError = validateEmailPassword(loginEmail, loginPassword);
    if (validationError) {
      setError(validationError);
      setIsLoading(false);
      return;
    }

    try {
      devLog("[auth] Starting login for:", loginEmail);
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });

      if (signInError) {
        devLog("[auth] Sign-in error:", signInError);
        setError(signInError.message);
        setIsLoading(false);
        return;
      }

      if (!data.user) {
        devLog("[auth] No user returned from sign-in");
        setError("Login failed: no user returned");
        setIsLoading(false);
        return;
      }

      if (!data.session) {
        setError("Login failed: missing session");
        setIsLoading(false);
        return;
      }

      // The @supabase/ssr browser client has already persisted the session to
      // the standard auth cookie — no manual cookie sync needed.
      devLog("[auth] Sign-in successful, user ID:", data.user.id);
      void ensureProfile().catch((err) => {
        console.warn("[auth] ensureProfile failed:", err);
      });

      Analytics.identify(data.user.id);
      Analytics.userLoggedIn("email");

      devLog("[auth] Navigating to", postAuthTarget);
      navigateAfterAuth(postAuthTarget);
    } catch (err) {
      devLog("[auth] Login error:", err);
      console.error("[auth] Full error stack:", err);
      setError(getErrorMessage(err, "Login failed. Please try again."));
      setIsLoading(false);
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setIsLoading(true);

    if (!ageConfirmed) {
      setError("You must confirm you are 18 or older");
      setIsLoading(false);
      return;
    }

    const validationError = validateEmailPassword(signupEmail, signupPassword);
    if (validationError) {
      setError(validationError);
      setIsLoading(false);
      return;
    }

    try {
      const result = await signUpWithEmail(signupEmail, signupPassword);
      if (!result.success) {
        setError(result.error || "Signup failed");
        setIsLoading(false);
        return;
      }

      const supabaseClient = getSupabaseBrowserClient();
      const { data: sessionData } = await supabaseClient.auth.getSession();

      if (sessionData?.session) {
        devLog("[auth] Signup successful with session, redirecting...");

        void ensureProfile().catch((err) => {
          console.warn("[auth] ensureProfile failed:", err);
        });

        navigateAfterAuth(postAuthTarget);
        return;
      }

      devLog("[auth] No session after signup, attempting auto-login...");
      const { data: loginData, error: loginError } = await supabaseClient.auth.signInWithPassword({
        email: signupEmail,
        password: signupPassword,
      });

      if (loginError || !loginData.session) {
        devLog("[auth] Auto-login failed:", loginError?.message);
        setInfo("Registration successful! Please check your email to verify your account.");
        setIsLoading(false);
        return;
      }

      devLog("[auth] Auto-login successful, redirecting...");
      Analytics.identify(loginData.session.user.id);
      Analytics.userRegistered("email");

      void ensureProfile().catch((err) => {
        console.warn("[auth] ensureProfile failed:", err);
      });

      navigateAfterAuth(postAuthTarget);
    } catch (err) {
      setError(getErrorMessage(err));
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setInfo(null);
    setIsLoading(true);

    try {
      const result = await signInWithGoogle();
      if (!result.success) {
        setError(result.error || "Unable to sign in with Google. Please try again.");
        setIsLoading(false);
      }
    } catch (err) {
      setError(getErrorMessage(err));
      setIsLoading(false);
    }
  };

  return (
    <div
      data-testid="page-ready"
      className="auth-layout bg-bg-base"
      style={{ touchAction: "manipulation", overscrollBehaviorY: "contain" }}
    >
      {/* ── PC Hero Side (left 45%) ─────────────────────── */}
      <aside className="auth-hero relative overflow-hidden bg-[var(--bg-base)]">
        {/* Hero background photo (required by design spec) */}
        <Image
          src="/images/auth/hero-pc.jpg"
          alt="Creator showcasing content on GetFanSee"
          width={1600}
          height={1200}
          sizes="(min-width: 1024px) 45vw, 100vw"
          className="absolute inset-0 w-full h-full object-cover opacity-[0.12]"
          aria-hidden="true"
          priority
        />

        {/* Geometric pattern overlay */}
        <svg
          className="absolute inset-0 w-full h-full opacity-[0.06]"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <defs>
            <pattern id="auth-grid" width="48" height="48" patternUnits="userSpaceOnUse">
              <path d="M 48 0 L 0 0 0 48" fill="none" stroke="white" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#auth-grid)" />
        </svg>
        {/* Decorative arcs */}
        <svg
          className="absolute inset-0 w-full h-full opacity-[0.08]"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          preserveAspectRatio="xMidYMid slice"
        >
          <circle cx="100%" cy="0" r="520" fill="none" stroke="white" strokeWidth="1" />
          <circle cx="100%" cy="0" r="360" fill="none" stroke="white" strokeWidth="0.5" />
          <circle cx="0" cy="100%" r="400" fill="none" stroke="white" strokeWidth="0.8" />
          <line x1="0" y1="0" x2="100%" y2="100%" stroke="white" strokeWidth="0.4" />
          <line x1="100%" y1="0" x2="0" y2="100%" stroke="white" strokeWidth="0.4" />
        </svg>

        {/* Subtle warm ambient glow */}
        <div className="absolute top-1/4 left-1/3 w-72 h-72 rounded-full bg-[var(--wine)]/12 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-[var(--premium)]/8 blur-3xl" />

        {/* Content */}
        <div className="absolute inset-0 flex flex-col justify-between p-10">
          {/* Top branding */}
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-[var(--radius-sm)] bg-[var(--wine)]/15 border border-[var(--wine)]/30 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-wine-text" aria-hidden="true" />
            </div>
            <span className="font-bold text-[22px] text-white tracking-tight">GetFanSee</span>
          </div>

          {/* Center feature callouts */}
          <div className="space-y-3">
            {[
              {
                Icon: DollarSign,
                text: "Monetize your passion & earn more",
                color: "text-[var(--success)]",
              },
              {
                Icon: Lock,
                text: "Exclusive content for your subscribers",
                color: "text-wine-text",
              },
              { Icon: Globe, text: "Reach fans all around the world", color: "text-[var(--info)]" },
            ].map((f) => (
              <div
                key={f.text}
                className="flex items-center gap-3.5 px-4 py-3.5 rounded-[var(--radius-lg)] bg-white/4 border border-white/8"
              >
                <div className="w-9 h-9 rounded-[var(--radius-sm)] bg-white/6 flex items-center justify-center shrink-0">
                  <f.Icon className={`w-5 h-5 ${f.color}`} aria-hidden="true" />
                </div>
                <p className="text-[0.9375rem] text-[var(--text-primary)] font-medium leading-snug">
                  {f.text}
                </p>
              </div>
            ))}
          </div>

          {/* Bottom title — Fraunces display */}
          <div>
            <p className="font-display text-5xl font-bold text-[var(--text-primary)] leading-tight mb-3">
              Where Creators
              <br />
              <span className="text-wine-text">Get Paid.</span>
            </p>
            <p className="text-[1.0625rem] text-[var(--text-muted)] leading-relaxed">
              The premium content platform
              <br />
              built for independent creators.
            </p>
          </div>
        </div>
      </aside>

      {/* ── Form Side (right 55%) ───────────────────────── */}
      <section className="auth-form bg-bg-base">
        <div className="w-full max-w-sm">
          {/* Logo (mobile only — desktop logo is in hero) */}
          <div className="flex items-center gap-2 mb-6 lg:hidden">
            <div className="size-8 rounded-[var(--radius-sm)] bg-[var(--wine)] flex items-center justify-center">
              <span className="text-text-primary font-bold text-[0.75rem]">G</span>
            </div>
            <span className="font-bold text-[1rem] text-[var(--text-primary)]">GetFanSee</span>
          </div>

          {/* Heading */}
          <div className="mb-6">
            <h1 className="text-h1 text-[var(--text-primary)] mb-1.5">
              {activeTab === "login" ? "Welcome back" : "Join the community"}
            </h1>
            <p className="text-[0.875rem] text-[var(--text-muted)]">
              {activeTab === "login"
                ? "Sign in to access your exclusive content"
                : "Create your account and discover exclusive creators"}
            </p>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <TabsList className="w-full mb-5">
              <TabsTrigger value="login" data-testid="auth-tab-login" className="flex-1">
                Sign In
              </TabsTrigger>
              <TabsTrigger value="signup" data-testid="auth-tab-signup" className="flex-1">
                Create Account
              </TabsTrigger>
            </TabsList>

            {/* Alerts */}
            {error && (
              <div
                data-testid="auth-error"
                className="flex items-start gap-2 mb-4 p-3 rounded-[var(--radius-md)] bg-[var(--error)]/8 border border-[var(--error)]/25"
                role="alert"
              >
                <AlertCircle className="size-[0.875rem] text-[var(--error)] shrink-0 mt-0.5" />
                <p className="text-[0.75rem] text-[var(--error)]">{error}</p>
              </div>
            )}
            {info && (
              <div
                data-testid="auth-info"
                className="mb-4 p-3 rounded-[var(--radius-md)] bg-[var(--success)]/8 border border-[var(--success)]/25"
                role="status"
              >
                <p className="text-[0.75rem] text-[var(--success)]">{info}</p>
              </div>
            )}

            {/* ── Sign In Tab ── */}
            <TabsContent value="login">
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="you@example.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    disabled={isLoading}
                    required
                    autoComplete="email"
                    data-testid="auth-email"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="login-password">Password</Label>
                  <div className="relative">
                    <Input
                      id="login-password"
                      type={showLoginPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      disabled={isLoading}
                      required
                      autoComplete="current-password"
                      data-testid="auth-password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-white transition-colors rounded-sm p-0.5"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      aria-label={showLoginPassword ? "Hide password" : "Show password"}
                    >
                      {showLoginPassword ? (
                        <EyeOff className="size-[14px]" />
                      ) : (
                        <Eye className="size-[14px]" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Link
                    href="/auth/forgot-password"
                    className="text-[0.75rem] text-wine-text hover:text-[var(--wine-hover)] transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>

                <Button
                  type="submit"
                  variant="default"
                  size="lg"
                  className="w-full"
                  disabled={isLoading}
                  loading={isLoading}
                  data-testid="auth-submit"
                >
                  Sign In
                </Button>
              </form>

              {!isTestMode && (
                <div className="mt-4">
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-white/8" />
                    </div>
                    <div className="relative flex justify-center">
                      <span className="bg-[var(--bg-base)] px-3 text-[0.6875rem] text-[var(--text-muted)]">
                        or continue with
                      </span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="default"
                    className="w-full"
                    onClick={handleGoogleSignIn}
                    disabled={isLoading}
                    data-testid="auth-google-button-login"
                  >
                    <svg className="size-[16px]" viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        fill="#4285F4"
                      />
                      <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                      />
                      <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        fill="#EA4335"
                      />
                    </svg>
                    Continue with Google
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* ── Sign Up Tab ── */}
            <TabsContent value="signup">
              {/* InvitedBanner — shown when user arrives via a referral link */}
              {isInvited && (
                <div className="mb-4 rounded-[var(--radius-lg)] border border-[var(--wine)]/25 bg-[var(--wine-tint)] px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <Sparkles size={16} className="text-wine-text shrink-0" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="text-small font-semibold text-text-primary">
                        {refName ? `Invited by ${refName}` : "You were invited"}
                      </p>
                      <p className="text-tiny text-text-secondary mt-0.5">
                        Create exclusive content and earn on your terms.{" "}
                        <a
                          href="/privacy"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-text-tertiary underline underline-offset-2"
                        >
                          Privacy Policy
                        </a>
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <form onSubmit={handleSignupSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="you@example.com"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    disabled={isLoading}
                    required
                    autoComplete="email"
                    data-testid="auth-email"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="signup-password">Password</Label>
                  <div className="relative">
                    <Input
                      id="signup-password"
                      type={showSignupPassword ? "text" : "password"}
                      placeholder="At least 8 characters"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      disabled={isLoading}
                      required
                      autoComplete="new-password"
                      data-testid="auth-password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-white transition-colors rounded-sm p-0.5"
                      onClick={() => setShowSignupPassword(!showSignupPassword)}
                      aria-label={showSignupPassword ? "Hide password" : "Show password"}
                    >
                      {showSignupPassword ? (
                        <EyeOff className="size-[14px]" />
                      ) : (
                        <Eye className="size-[14px]" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 pt-1">
                  <Checkbox
                    id="age-confirm"
                    checked={ageConfirmed}
                    onCheckedChange={(checked) => setAgeConfirmed(checked === true)}
                    disabled={isLoading}
                    data-testid="auth-age-checkbox"
                    className="mt-0.5 size-4"
                  />
                  <label
                    htmlFor="age-confirm"
                    className="text-tiny text-text-muted leading-relaxed cursor-pointer"
                  >
                    I confirm I am 18 years or older and agree to the{" "}
                    <Link href="/terms" className="text-wine-text hover:underline">
                      Terms of Service
                    </Link>{" "}
                    and{" "}
                    <Link href="/privacy" className="text-wine-text hover:underline">
                      Privacy Policy
                    </Link>
                  </label>
                </div>

                {!ageConfirmed && (
                  <p className="text-tiny text-text-muted" data-testid="auth-age-hint">
                    You must confirm you are 18+ to create an account.
                  </p>
                )}

                <Button
                  type="submit"
                  variant="default"
                  size="lg"
                  className="w-full"
                  disabled={isLoading || !ageConfirmed}
                  loading={isLoading}
                  data-testid="auth-submit"
                >
                  Create Account
                </Button>
              </form>

              {!isTestMode && (
                <div className="mt-4">
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-white/8" />
                    </div>
                    <div className="relative flex justify-center">
                      <span className="bg-[var(--bg-base)] px-3 text-[0.6875rem] text-[var(--text-muted)]">
                        or continue with
                      </span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="default"
                    className="w-full"
                    onClick={handleGoogleSignIn}
                    disabled={isLoading}
                    data-testid="auth-google-button-signup"
                  >
                    <svg className="size-[16px]" viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        fill="#4285F4"
                      />
                      <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                      />
                      <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        fill="#EA4335"
                      />
                    </svg>
                    Continue with Google
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Trust strip */}
          <TrustStrip
            className="mt-6"
            items={["Secure & Encrypted", "24/7 Support", "Private & Discreet"]}
          />

          <p className="mt-4 text-center text-tiny text-text-disabled">
            © 2026 GetFanSee. All rights reserved.
          </p>
        </div>
      </section>
    </div>
  );
}
