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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { ensureProfile, signInWithGoogle, signUpWithEmail } from "@/lib/auth";
import { captureReferralFromUrl } from "@/lib/referral";
import { AlertCircle, Loader2 } from "lucide-react";

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

  const resetAuthState = useCallback(() => {
    setError(null);
    setInfo(null);
    setLoginEmail("");
    setLoginPassword("");
    setSignupEmail("");
    setSignupPassword("");
    setAgeConfirmed(false);
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

      devLog("[auth] Profile ensured, navigating to /home");
      router.push("/home");
      router.refresh(); // Force refresh to ensure navigation

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

      // 注册成功后，检查是否有 session
      const supabaseClient = getSupabaseBrowserClient();
      const { data: sessionData } = await supabaseClient.auth.getSession();

      if (sessionData?.session) {
        // 有 session，直接跳转到 home
        devLog("[auth] Signup successful with session, redirecting...");

        // 同步 session 到服务器
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

        // 确保 profile 存在
        void ensureProfile().catch((err) => {
          console.warn("[auth] ensureProfile failed:", err);
        });

        // 跳转到 home
        router.push("/home");
        router.refresh();
        return;
      }

      // 没有 session，尝试自动登录（邮箱验证关闭时应该能成功）
      devLog("[auth] No session after signup, attempting auto-login...");
      const { data: loginData, error: loginError } = await supabaseClient.auth.signInWithPassword({
        email: signupEmail,
        password: signupPassword,
      });

      if (loginError || !loginData.session) {
        // 自动登录失败，可能需要邮箱验证
        devLog("[auth] Auto-login failed:", loginError?.message);
        setInfo("Registration successful! Please check your email to verify your account.");
        setIsLoading(false);
        return;
      }

      // 自动登录成功
      devLog("[auth] Auto-login successful, redirecting...");
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

      router.push("/home");
      router.refresh();
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
      className="min-h-screen flex items-center justify-center px-6 py-12 bg-background relative overflow-hidden"
      style={{ touchAction: "manipulation", overscrollBehaviorY: "contain" }}
    >
      {/* Decorative Background Elements */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-primary/20 rounded-full blur-[128px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-brand-accent/20 rounded-full blur-[128px]" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-12 cursor-pointer group">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-14 h-14 bg-gradient-primary rounded-2xl group-hover:scale-105 transition-transform shadow-glow flex items-center justify-center">
              <span className="text-2xl font-bold text-white">GF</span>
            </div>
            <span className="text-3xl font-bold text-gradient-primary tracking-tight">
              GetFanSee
            </span>
          </Link>
        </div>

        {/* Auth Card */}
        <div className="glass-strong rounded-3xl p-8 shadow-xl">
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-8 h-12 bg-surface-raised rounded-xl p-1">
              <TabsTrigger
                value="login"
                data-testid="auth-tab-login"
                className="rounded-lg text-base font-semibold data-[state=active]:bg-brand-primary data-[state=active]:text-white data-[state=active]:shadow-md transition-all"
              >
                Login
              </TabsTrigger>
              <TabsTrigger
                value="signup"
                data-testid="auth-tab-signup"
                className="rounded-lg text-base font-semibold data-[state=active]:bg-brand-primary data-[state=active]:text-white data-[state=active]:shadow-md transition-all"
              >
                Sign Up
              </TabsTrigger>
            </TabsList>

            {/* 错误和信息提示 */}
            {error && (
              <Alert variant="destructive" className="mb-6">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {info && (
              <Alert className="mb-6">
                <AlertDescription>{info}</AlertDescription>
              </Alert>
            )}

            {/* 登录表单 */}
            <TabsContent value="login">
              <div className="space-y-5">
                <form onSubmit={handleLoginSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="login-email" className="text-sm font-semibold">
                      Email
                    </Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="you@example.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      disabled={isLoading}
                      required
                      data-testid="auth-email"
                      className="w-full px-4 py-3 bg-surface-base border border-border-subtle rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="login-password" className="text-sm font-semibold">
                      Password
                    </Label>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="Enter your password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      disabled={isLoading}
                      required
                      data-testid="auth-password"
                      className="w-full px-4 py-3 bg-surface-base border border-border-subtle rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary transition-all"
                    />
                  </div>

                  <div className="flex items-center justify-end">
                    <button
                      type="button"
                      className="text-sm text-brand-primary hover:text-brand-primary/80 transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>

                  <Button
                    type="submit"
                    className="w-full py-3 bg-gradient-primary text-white rounded-xl font-semibold hover:opacity-90 transition-all shadow-lg shadow-brand-primary/25"
                    disabled={isLoading}
                    aria-label="Sign in to your account"
                    data-testid="auth-submit"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                        Signing in…
                      </>
                    ) : (
                      "Login"
                    )}
                  </Button>
                </form>

                {!isTestMode && (
                  <>
                    <div className="relative my-6">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-border-base" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-surface-raised px-3 text-text-tertiary">
                          Or continue with
                        </span>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      className="w-full py-3 bg-surface-base border border-border-base rounded-xl font-semibold hover:bg-surface-raised transition-all"
                      onClick={handleGoogleSignIn}
                      disabled={isLoading}
                    >
                      <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
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
                      Google
                    </Button>
                  </>
                )}
              </div>
            </TabsContent>

            {/* 注册表单 */}
            <TabsContent value="signup">
              <div className="space-y-5">
                <form onSubmit={handleSignupSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="signup-email" className="text-sm font-semibold">
                      Email
                    </Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="you@example.com"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      disabled={isLoading}
                      required
                      data-testid="auth-email"
                      className="w-full px-4 py-3 bg-surface-base border border-border-subtle rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-password" className="text-sm font-semibold">
                      Password
                    </Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="Create a password"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      disabled={isLoading}
                      required
                      data-testid="auth-password"
                      className="w-full px-4 py-3 bg-surface-base border border-border-subtle rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary transition-all"
                    />
                    <p className="text-xs text-text-tertiary">At least 8 characters</p>
                  </div>

                  <div className="space-y-3 py-2">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="age-confirm"
                        checked={ageConfirmed}
                        onCheckedChange={(checked) => setAgeConfirmed(checked === true)}
                        disabled={isLoading}
                        data-testid="auth-age-checkbox"
                        className="mt-0.5"
                        aria-label="I confirm I am 18+ and agree to the Terms"
                      />
                      <label
                        htmlFor="age-confirm"
                        className="text-sm leading-relaxed cursor-pointer select-none flex-1 text-text-secondary"
                      >
                        I confirm I am 18+ and agree to the{" "}
                        <Link href="/terms" className="text-brand-primary hover:underline">
                          Terms of Service
                        </Link>{" "}
                        and{" "}
                        <Link href="/privacy" className="text-brand-primary hover:underline">
                          Privacy Policy
                        </Link>
                      </label>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full py-3 bg-gradient-primary text-white rounded-xl font-semibold hover:opacity-90 transition-all shadow-lg shadow-brand-primary/25 disabled:opacity-40"
                    disabled={isLoading || !ageConfirmed}
                    aria-label="Create your account"
                    data-testid="auth-submit"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                        Creating account…
                      </>
                    ) : (
                      "Create Account"
                    )}
                  </Button>
                </form>

                {!isTestMode && (
                  <>
                    <div className="relative my-6">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-border-base" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-surface-raised px-3 text-text-tertiary">
                          Or continue with
                        </span>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      className="w-full py-3 bg-surface-base border border-border-base rounded-xl font-semibold hover:bg-surface-raised transition-all"
                      onClick={handleGoogleSignIn}
                      disabled={isLoading}
                      aria-label="Sign up with Google"
                    >
                      <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
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
                      Google
                    </Button>
                  </>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer Links */}
        <div className="mt-6 text-center text-sm text-text-tertiary">
          <p>© 2026 GetFanSee. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
