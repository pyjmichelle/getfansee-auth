"use client";

import type React from "react";
import { useRouter } from "next/navigation";
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
import { syncSessionCookies } from "@/lib/auth-session-client";
import { captureReferralFromUrl } from "@/lib/referral";
import { Analytics } from "@/lib/analytics";
import { invalidateAuthBootstrap, prefetchAuthBootstrap } from "@/lib/auth-bootstrap-client";
import { AlertCircle, Loader2, Eye, EyeOff, DollarSign, Lock, Globe, Sparkles } from "@/lib/icons";
import { TrustStrip } from "@/components/trust-strip";

type AuthPageClientProps = {
  initialMode?: "login" | "signup";
};

const devLog = (...args: unknown[]) => {
  if (process.env.NODE_ENV === "development") {
    console.warn(...args);
  }
};

const getErrorMessage = (error: unknown, fallback = "Internal server error") =>
  error instanceof Error ? error.message : fallback;

export default function AuthPageClient({ initialMode = "login" }: AuthPageClientProps) {
  const supabase = getSupabaseBrowserClient();
  const router = useRouter();
  const isTestMode = process.env.NEXT_PUBLIC_TEST_MODE === "true";

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"login" | "signup">(initialMode);
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

      let sessionSyncOk = await syncSessionCookies(data.session);
      if (!sessionSyncOk) {
        // Retry once with latest session snapshot to avoid transient verification races
        const { data: refreshed } = await supabase.auth.getSession();
        if (refreshed.session) {
          sessionSyncOk = await syncSessionCookies(refreshed.session);
        }
      }
      if (!sessionSyncOk) {
        console.warn("[auth] Session sync failed; continuing with client session.");
      }
      devLog("[auth] Session synced");

      devLog("[auth] Sign-in successful, user ID:", data.user.id);
      devLog("[auth] Ensuring profile...");
      void ensureProfile().catch((err) => {
        console.warn("[auth] ensureProfile failed:", err);
      });
      invalidateAuthBootstrap();
      prefetchAuthBootstrap();

      Analytics.identify(data.user.id);
      Analytics.userLoggedIn("email");

      devLog("[auth] Profile ensured, navigating to /home");
      router.push("/home");

      devLog("[auth] Navigation initiated");
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

        const sessionSyncOk = await syncSessionCookies(sessionData.session);
        if (!sessionSyncOk) {
          console.warn("[auth] Session sync failed but continuing...");
        }

        void ensureProfile().catch((err) => {
          console.warn("[auth] ensureProfile failed:", err);
        });
        invalidateAuthBootstrap();
        prefetchAuthBootstrap();

        router.push("/home");
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
      const sessionSyncOk = await syncSessionCookies(loginData.session);
      if (!sessionSyncOk) {
        console.warn("[auth] Session sync failed but continuing...");
      }

      void ensureProfile().catch((err) => {
        console.warn("[auth] ensureProfile failed:", err);
      });
      invalidateAuthBootstrap();
      prefetchAuthBootstrap();

      router.push("/home");
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
      <aside className="auth-hero relative overflow-hidden bg-gradient-to-br from-[#0d0720] via-[#150a2e] to-[#0a0d2e]">
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

        {/* Glowing orbs */}
        <div className="absolute top-1/4 left-1/3 w-72 h-72 rounded-full bg-violet-600/25 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute top-2/3 left-1/5 w-56 h-56 rounded-full bg-purple-400/15 blur-2xl" />

        {/* Content */}
        <div className="absolute inset-0 flex flex-col justify-between p-10">
          {/* Top branding */}
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-[var(--radius-sm)] bg-white/10 border border-white/20 flex items-center justify-center shadow-glow-violet backdrop-blur-sm">
              <Sparkles className="w-6 h-6 text-violet-300" aria-hidden="true" />
            </div>
            <span className="font-bold text-[22px] text-white tracking-tight">GetFanSee</span>
          </div>

          {/* Center feature callouts */}
          <div className="space-y-3">
            {[
              {
                Icon: DollarSign,
                text: "Monetize your passion & earn more",
                color: "text-emerald-400",
              },
              {
                Icon: Lock,
                text: "Exclusive content for your subscribers",
                color: "text-violet-400",
              },
              { Icon: Globe, text: "Reach fans all around the world", color: "text-sky-400" },
            ].map((f) => (
              <div
                key={f.text}
                className="flex items-center gap-3.5 px-4 py-3.5 rounded-2xl bg-white/6 border border-white/10 backdrop-blur-sm"
              >
                <div className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center shrink-0">
                  <f.Icon className={`w-5 h-5 ${f.color}`} aria-hidden="true" />
                </div>
                <p className="text-[15px] text-white/90 font-medium leading-snug">{f.text}</p>
              </div>
            ))}
          </div>

          {/* Bottom title */}
          <div>
            <p className="text-5xl font-serif font-bold text-white leading-tight mb-3">
              Where Creators
              <br />
              <span className="text-gradient-primary">Get Paid.</span>
            </p>
            <p className="text-lg text-white/50 leading-relaxed">
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
            <div className="size-8 rounded-[var(--radius-sm)] bg-gradient-to-br from-violet-600 to-violet-400 flex items-center justify-center shadow-glow-violet">
              <span className="text-white font-bold text-[12px]">G</span>
            </div>
            <span className="font-bold text-[16px] text-white">GetFanSee</span>
          </div>

          {/* Heading */}
          <div className="mb-6">
            <h1 className="font-serif text-h1 text-white mb-1">
              {activeTab === "login" ? "Welcome back" : "Join the community"}
            </h1>
            <p className="text-[13px] text-text-muted">
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
                className="flex items-start gap-2 mb-4 p-3 rounded-[var(--radius-sm)] bg-red-500/10 border border-red-500/20"
                role="alert"
              >
                <AlertCircle className="size-[14px] text-red-400 shrink-0 mt-0.5" />
                <p className="text-[12px] text-red-400">{error}</p>
              </div>
            )}
            {info && (
              <div
                data-testid="auth-info"
                className="mb-4 p-3 rounded-[var(--radius-sm)] bg-emerald-500/10 border border-emerald-500/20"
                role="status"
              >
                <p className="text-[12px] text-emerald-400">{info}</p>
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
                    className="text-[12px] text-violet-400 hover:text-violet-300 transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>

                <Button
                  type="submit"
                  variant="violet"
                  size="lg"
                  className="w-full"
                  disabled={isLoading}
                  data-testid="auth-submit"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="size-[14px] animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    "Sign In"
                  )}
                </Button>
              </form>

              {!isTestMode && (
                <div className="mt-4">
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-white/8" />
                    </div>
                    <div className="relative flex justify-center">
                      <span className="bg-bg-base px-3 text-[11px] text-text-muted uppercase tracking-wider">
                        Or continue with
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
                    className="text-[12px] text-text-muted leading-relaxed cursor-pointer"
                  >
                    I confirm I am 18 years or older and agree to the{" "}
                    <Link href="/terms" className="text-violet-400 hover:underline">
                      Terms of Service
                    </Link>{" "}
                    and{" "}
                    <Link href="/privacy" className="text-violet-400 hover:underline">
                      Privacy Policy
                    </Link>
                  </label>
                </div>

                {!ageConfirmed && (
                  <p className="text-[11px] text-text-muted" data-testid="auth-age-hint">
                    You must confirm you are 18+ to create an account.
                  </p>
                )}

                <Button
                  type="submit"
                  variant="violet"
                  size="lg"
                  className="w-full"
                  disabled={isLoading || !ageConfirmed}
                  data-testid="auth-submit"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="size-[14px] animate-spin" />
                      Creating account...
                    </>
                  ) : (
                    "Create Account"
                  )}
                </Button>
              </form>

              {!isTestMode && (
                <div className="mt-4">
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-white/8" />
                    </div>
                    <div className="relative flex justify-center">
                      <span className="bg-bg-base px-3 text-[11px] text-text-muted uppercase tracking-wider">
                        Or continue with
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

          <p className="mt-4 text-center text-[11px] text-text-disabled">
            © 2026 GetFanSee. All rights reserved.
          </p>
        </div>
      </section>
    </div>
  );
}
