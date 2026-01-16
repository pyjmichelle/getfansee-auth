"use client";

import type React from "react";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { ensureProfile, signInWithGoogle, signUpWithEmail } from "@/lib/auth";
import { captureReferralFromUrl } from "@/lib/referral";
import { AlertCircle, Loader2, Sparkles, Shield, Users } from "lucide-react";

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
      return "Please fill in all fields";
    }
    if (!email.includes("@")) {
      return "Please enter a valid email address";
    }
    if (password.length < 8) {
      return "Password must be at least 8 characters";
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
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });

      if (signInError) {
        setError(signInError.message);
        setIsLoading(false);
        return;
      }

      if (!data.user) {
        setError("Login failed: no user returned");
        setIsLoading(false);
        return;
      }

      await ensureProfile();
      router.push("/home");
    } catch (err) {
      setError(getErrorMessage(err));
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

      setInfo("Registration successful! Please check your email to verify your account.");
      setIsLoading(false);
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
        setError(result.error || "Google sign-in failed");
        setIsLoading(false);
      }
    } catch (err) {
      setError(getErrorMessage(err));
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* 左侧 - 品牌展示区 (仅桌面显示) */}
      <div className="hidden lg:flex bg-gradient-to-br from-primary via-primary/90 to-primary/80 text-primary-foreground p-12 flex-col justify-between">
        <div>
          <h1 className="text-5xl font-bold mb-4 tracking-tight">GetFansee</h1>
          <p className="text-xl opacity-90 font-medium">Connect with your favorite creators</p>
        </div>

        <div className="space-y-8">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-primary-foreground/10 rounded-xl backdrop-blur-sm">
              <Sparkles className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-1">Exclusive Content</h3>
              <p className="opacity-80 text-sm">Access premium content from top creators</p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="p-3 bg-primary-foreground/10 rounded-xl backdrop-blur-sm">
              <Shield className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-1">Secure & Private</h3>
              <p className="opacity-80 text-sm">Your privacy and security are our top priority</p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="p-3 bg-primary-foreground/10 rounded-xl backdrop-blur-sm">
              <Users className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-1">Growing Community</h3>
              <p className="opacity-80 text-sm">Join thousands of fans and creators</p>
            </div>
          </div>
        </div>

        <div className="text-sm opacity-70">© 2026 GetFansee. All rights reserved.</div>
      </div>

      {/* 右侧 - 认证表单 */}
      <div className="flex items-center justify-center p-6 sm:p-8 lg:p-12 bg-background">
        <div className="w-full max-w-md">
          {/* 移动端 Logo */}
          <div className="lg:hidden text-center mb-8">
            <h1 className="text-3xl font-bold text-primary mb-2">GetFansee</h1>
            <p className="text-muted-foreground">Connect with creators</p>
          </div>

          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
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
              <Card className="rounded-xl border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-2xl">Welcome Back</CardTitle>
                  <CardDescription className="text-base">
                    Enter your credentials to access your account
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleLoginSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-email">Email</Label>
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="your@email.com"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        disabled={isLoading}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="login-password">Password</Label>
                      <Input
                        id="login-password"
                        type="password"
                        placeholder="••••••••"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        disabled={isLoading}
                        required
                      />
                    </div>

                    <Button
                      type="submit"
                      className="w-full rounded-xl min-h-[44px]"
                      disabled={isLoading}
                      aria-label="Sign in to your account"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                          Signing in...
                        </>
                      ) : (
                        "Sign In"
                      )}
                    </Button>
                  </form>

                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">
                        Or continue with
                      </span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
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
                </CardContent>
              </Card>
            </TabsContent>

            {/* 注册表单 */}
            <TabsContent value="signup">
              <Card className="rounded-xl border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-2xl">Create Account</CardTitle>
                  <CardDescription className="text-base">
                    Join GetFansee to connect with amazing creators
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSignupSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-email">Email</Label>
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="your@email.com"
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                        disabled={isLoading}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-password">Password</Label>
                      <Input
                        id="signup-password"
                        type="password"
                        placeholder="••••••••"
                        value={signupPassword}
                        onChange={(e) => setSignupPassword(e.target.value)}
                        disabled={isLoading}
                        required
                      />
                      <p className="text-xs text-muted-foreground">Must be at least 8 characters</p>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="age-confirm"
                        checked={ageConfirmed}
                        onCheckedChange={(checked) => setAgeConfirmed(checked === true)}
                        disabled={isLoading}
                      />
                      <label
                        htmlFor="age-confirm"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        I confirm I am 18 years or older
                      </label>
                    </div>

                    <Button
                      type="submit"
                      className="w-full rounded-xl min-h-[44px]"
                      disabled={isLoading || !ageConfirmed}
                      aria-label="Create your account"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                          Creating account...
                        </>
                      ) : (
                        "Create Account"
                      )}
                    </Button>
                  </form>

                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">
                        Or continue with
                      </span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full rounded-xl min-h-[44px]"
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
                </CardContent>
                <CardFooter className="flex flex-col space-y-2 text-xs text-muted-foreground">
                  <p>
                    By creating an account, you agree to our Terms of Service and Privacy Policy.
                  </p>
                </CardFooter>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
