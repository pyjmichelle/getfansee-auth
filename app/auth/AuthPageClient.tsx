"use client";

import type React from "react";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { ensureProfile, signInWithGoogle, signUpWithEmail } from "@/lib/auth";
import { captureReferralFromUrl } from "@/lib/referral";
import { Analytics } from "@/lib/analytics";
import { invalidateAuthBootstrap, prefetchAuthBootstrap } from "@/lib/auth-bootstrap-client";
import { AlertCircle, Loader2, Eye, EyeOff, Users, DollarSign, Sparkles, Star } from "@/lib/icons";
import { useCountUp } from "@/hooks/use-count-up";
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

  // Social proof counters
  const creatorCount = useCountUp(12480, { duration: 1200, decimals: 0 });
  const fanCount = useCountUp(89340, { duration: 1400, decimals: 0 });
  const earningsCount = useCountUp(2400000, { duration: 1600, decimals: 0 });

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

      const sessionSync = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_in: data.session.expires_in,
        }),
      });

      if (!sessionSync.ok) {
        setError("Login failed: session sync error");
        setIsLoading(false);
        return;
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

        const sessionSync = await fetch("/api/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            access_token: sessionData.session.access_token,
            refresh_token: sessionData.session.refresh_token,
            expires_in: sessionData.session.expires_in,
          }),
        });

        if (!sessionSync.ok) {
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
      const sessionSync = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_token: loginData.session.access_token,
          refresh_token: loginData.session.refresh_token,
          expires_in: loginData.session.expires_in,
        }),
      });

      if (!sessionSync.ok) {
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

  const socialProofItems = [
    {
      icon: Users,
      label: "Active Creators",
      value: creatorCount.toLocaleString(),
      color: "text-brand-primary",
      bg: "bg-brand-primary/10",
    },
    {
      icon: Star,
      label: "Happy Fans",
      value: fanCount.toLocaleString(),
      color: "text-brand-accent",
      bg: "bg-brand-accent/10",
    },
    {
      icon: DollarSign,
      label: "Paid to Creators",
      value: `$${(earningsCount / 1_000_000).toFixed(1)}M+`,
      color: "text-success",
      bg: "bg-success/10",
    },
  ];

  return (
    <div
      data-testid="page-ready"
      className="auth-layout bg-bg-base"
      style={{ touchAction: "manipulation", overscrollBehaviorY: "contain" }}
    >
      {/* ── PC Hero Side (left 45%) ─────────────────────── */}
      <aside className="auth-hero relative bg-bg-surface overflow-hidden">
        <img
          src="/images/auth/hero-pc.jpg"
          alt="GetFanSee creator community"
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Vignette overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/70" />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/20" />

        {/* Bottom branding */}
        <div className="absolute bottom-0 left-0 right-0 p-8">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="size-9 rounded-[var(--radius-sm)] bg-gradient-to-br from-violet-600 to-violet-400 flex items-center justify-center shadow-glow-violet">
              <span className="text-white font-bold text-[13px]">G</span>
            </div>
            <span className="font-bold text-[18px] text-white tracking-tight">GetFanSee</span>
          </div>
          <p className="text-[22px] font-serif font-bold text-white leading-snug mb-2">
            Where Creators
            <br />
            <span className="text-gradient-primary">Get Paid.</span>
          </p>
          <p className="text-[13px] text-white/60">Join 50,000+ fans worldwide</p>

          {/* Social proof stats */}
          <div className="flex items-center gap-4 mt-4">
            {socialProofItems.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="text-center">
                  <Icon className="size-[14px] text-violet-400 mx-auto mb-0.5" aria-hidden="true" />
                  <p className="text-[13px] font-bold text-white">{item.value}</p>
                  <p className="text-[10px] text-white/50">{item.label}</p>
                </div>
              );
            })}
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
                className="flex items-start gap-2 mb-4 p-3 rounded-[var(--radius-sm)] bg-red-500/10 border border-red-500/20"
                role="alert"
              >
                <AlertCircle className="size-[14px] text-red-400 shrink-0 mt-0.5" />
                <p className="text-[12px] text-red-400">{error}</p>
              </div>
            )}
            {info && (
              <div
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
                    href="/auth/resend-verification"
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
                  >
                    <Sparkles className="size-[14px]" />
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
                    className="mt-0.5"
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
                  >
                    <Sparkles className="size-[14px]" />
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

          {/* Mobile social proof — hidden on desktop (hero already shows it) */}
          <div className="mt-5 pt-5 border-t border-white/6 lg:hidden">
            <p className="text-center text-[11px] text-text-muted mb-3 uppercase tracking-wider font-medium">
              Trusted by
            </p>
            <div className="grid grid-cols-3 gap-2">
              {socialProofItems.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className="flex flex-col items-center gap-1 p-2.5 rounded-[var(--radius-sm)] bg-white/4 border border-white/6"
                  >
                    <div
                      className={`size-7 rounded-full ${item.bg} flex items-center justify-center`}
                    >
                      <Icon className={`size-[13px] ${item.color}`} aria-hidden="true" />
                    </div>
                    <p className={`text-[13px] font-bold ${item.color}`}>{item.value}</p>
                    <p className="text-[10px] text-text-muted text-center leading-tight">
                      {item.label}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="mt-4 text-center text-[11px] text-text-disabled">
            © 2026 GetFanSee. All rights reserved.
          </p>
        </div>
      </section>
    </div>
  );
}
