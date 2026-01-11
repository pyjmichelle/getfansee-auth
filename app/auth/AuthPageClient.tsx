"use client";

import type React from "react";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ensureProfile, signInWithGoogle, signUpWithEmail } from "@/lib/auth";
import { captureReferralFromUrl } from "@/lib/referral";

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

  // 归因逻辑：URL 参数 ?ref= 捕获并存入 Cookie
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
      devLog("[auth] Starting login...", { email: loginEmail });

      // 使用 createBrowserClient 直接调用 Supabase 登录
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });

      devLog("[auth] Login result:", {
        hasSession: !!data?.session,
        hasUser: !!data?.user,
        error: signInError?.message || "none",
      });

      if (signInError) {
        console.error("[auth] signInWithPassword error:", signInError);
        let errorMessage = "登录失败，请重试";

        if (
          signInError.message.includes("Invalid login credentials") ||
          signInError.message.includes("invalid_credentials")
        ) {
          errorMessage = "邮箱或密码错误，请重试";
        } else if (signInError.message.includes("email_not_confirmed")) {
          errorMessage = "请先验证您的邮箱";
        } else {
          errorMessage = signInError.message;
        }

        setError(errorMessage);
        setIsLoading(false);
        return;
      }

      // 登录成功后：ensureProfile() → /home (unconditionally)
      if (data?.session) {
        try {
          devLog("[auth] Ensuring profile...");
          await ensureProfile();
          devLog("[auth] Profile ensured, redirecting to /home");
          // 清除 loading 状态后再跳转
          setIsLoading(false);
          // 使用 window.location 确保页面完全刷新，避免 Server Component 缓存问题
          window.location.href = "/home";
          return;
        } catch (profileError: unknown) {
          console.error("[auth] Profile error:", profileError);
          // Profile 创建失败不应该阻止登录，只记录错误
          // 仍然跳转到首页
          setIsLoading(false);
          window.location.href = "/home";
          return;
        }
      } else {
        console.warn("[auth] Login successful but no session found");
        setError("登录成功但未找到会话，请重试");
        setIsLoading(false);
      }
    } catch (err: unknown) {
      console.error("[auth] Login error:", err);
      const rawMessage = getErrorMessage(err, "登录失败，请重试");
      let errorMessage = rawMessage;

      if (rawMessage.includes("Failed to fetch") || rawMessage.includes("NetworkError")) {
        errorMessage = "网络连接失败，请检查网络连接或稍后重试";
      }

      setError(errorMessage);
      setIsLoading(false);
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    devLog("[auth] handleSignupSubmit called", {
      signupEmail,
      hasPassword: !!signupPassword,
      ageConfirmed,
    });
    e.preventDefault();
    setError(null);
    setInfo(null);
    setIsLoading(true);
    devLog("[auth] After setIsLoading(true)");

    if (!ageConfirmed) {
      setError("You must confirm that you are 18+ to use this platform.");
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
      devLog("[auth] Signup result:", result);

      // 检查 Supabase 的响应
      if (result?.user) {
        // 如果 Supabase 配置为不需要邮箱验证，立即创建 profile
        if (result.session) {
          // 有 session 说明不需要邮箱验证，立即创建 profile 并重定向 (unconditionally)
          // 不等待 ensureProfile 完成，直接跳转（profile 可以在后台创建）
          ensureProfile().catch((err) => {
            console.error("[auth] ensureProfile error (non-blocking):", err);
          });
          // 使用 window.location.href 强制页面刷新，确保 Server Component 正确读取 session
          devLog("[auth] Setting window.location.href to /home (handleSignupSubmit)");
          window.location.href = "/home";
          devLog("[auth] window.location.href set (handleSignupSubmit), waiting for navigation...");
          // 给一点时间让导航开始
          await new Promise((resolve) => setTimeout(resolve, 100));
          return; // 立即返回，不执行 finally 中的 setIsLoading(false)
        } else {
          // 需要邮箱验证
          setInfo("Check your email for a confirmation link. After confirming, you can log in.");
        }
      } else {
        setInfo("Registration request sent. Please check your email for a confirmation link.");
      }
    } catch (err: unknown) {
      console.error("[auth] Signup error:", err);
      setError(getErrorMessage(err, "Signup failed. Please try again."));
    } finally {
      setIsLoading(false);
    }
  };

  // 移除 Magic Link 功能

  const handleGoogleAuth = async () => {
    setError(null);
    setInfo(null);
    try {
      await signInWithGoogle();
      // Supabase 会重定向回 /auth/verify，verify 页面中再 ensureProfile/redirect
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Google sign-in failed. Please check OAuth configuration."));
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 md:p-8">
      {/* PC: 左右分割布局 */}
      <div className="hidden lg:flex w-full max-w-7xl gap-16 items-center">
        {/* 左侧：品牌 Slogan 动画 */}
        <div className="flex-1 space-y-8">
          <div className="space-y-6">
            <h1 className="text-6xl font-bold text-primary-gradient bg-primary-gradient bg-clip-text text-transparent">
              GetFanSee
            </h1>
            <p className="text-2xl text-[#E5E5E5] font-light">
              Connect with creators.
              <br />
              Support their work.
              <br />
              <span className="text-accent-gradient bg-accent-gradient bg-clip-text text-transparent">
                Experience exclusive content.
              </span>
            </p>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse"></div>
            <span>18+ Adults Only Platform</span>
          </div>
        </div>

        {/* 右侧：登录框 */}
        <div className="flex-1 max-w-md">
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6 bg-[#0D0D0D] border border-[#1F1F1F] rounded-xl p-1">
              <TabsTrigger
                value="login"
                className="text-base rounded-lg data-[state=active]:bg-primary-gradient data-[state=active]:text-white"
              >
                Log in
              </TabsTrigger>
              <TabsTrigger
                value="signup"
                className="text-base rounded-lg data-[state=active]:bg-primary-gradient data-[state=active]:text-white"
              >
                Sign up
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <div className="bg-white/5 backdrop-blur-xl border border-[#1F1F1F] rounded-3xl p-8 space-y-6">
                <h2 className="text-xl font-semibold text-foreground">Welcome back</h2>
                <p className="text-xs text-muted-foreground">
                  Use your email and password to continue. We never share your credentials with
                  creators.
                </p>

                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  {error && (
                    <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm px-4 py-3 rounded-md">
                      {error}
                    </div>
                  )}
                  {info && (
                    <div className="bg-secondary/40 border border-secondary/60 text-xs text-foreground px-4 py-3 rounded-md">
                      {info}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="login-email" className="text-sm font-medium">
                      Email
                    </Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="you@example.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="h-11"
                      disabled={isLoading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="login-password-pc" className="text-sm font-medium">
                      Password
                    </Label>
                    <Input
                      id="login-password-pc"
                      type="password"
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="h-11"
                      disabled={isLoading}
                    />
                  </div>

                  <Button
                    type="submit"
                    variant="gradient"
                    className="w-full h-12 text-base font-medium rounded-xl"
                    disabled={isLoading}
                  >
                    {isLoading ? "Please wait..." : "Continue"}
                  </Button>

                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-border" />
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="px-3 bg-card text-muted-foreground">or continue with</span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-11 text-base font-medium bg-transparent"
                    onClick={handleGoogleAuth}
                    disabled={isLoading}
                  >
                    <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="currentColor"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    Continue with Google
                  </Button>
                </form>
              </div>
            </TabsContent>

            <TabsContent value="signup">
              <div className="bg-white/5 backdrop-blur-xl border border-[#1F1F1F] rounded-3xl p-8 space-y-6">
                <h2 className="text-2xl font-semibold text-foreground mb-1">Create your account</h2>
                <p className="text-xs text-muted-foreground">
                  This is an adults-only platform. You must be 18+ to sign up. We require email
                  verification before you can unlock or publish content.
                </p>

                <form onSubmit={handleSignupSubmit} className="space-y-4">
                  {error && (
                    <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm px-4 py-3 rounded-md">
                      {error}
                    </div>
                  )}
                  {info && (
                    <div className="bg-green-500/10 border border-green-500/20 text-green-400 text-sm px-4 py-3 rounded-md space-y-3">
                      <p>{info}</p>
                      {info.includes("Check your email") && (
                        <div className="flex flex-col gap-2 pt-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => {
                              // 打开 Gmail 或跳转到验证页面
                              window.open("https://mail.google.com", "_blank");
                              setTimeout(() => {
                                router.push("/auth/verify");
                              }, 1000);
                            }}
                          >
                            Open Gmail / I've confirmed
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="w-full text-xs"
                            onClick={async () => {
                              try {
                                const { error } = await supabase.auth.resend({
                                  type: "signup",
                                  email: signupEmail,
                                  options: {
                                    emailRedirectTo: `${window.location.origin}/auth/verify`,
                                  },
                                });
                                if (error) throw error;
                                setInfo("Verification email resent! Please check your inbox.");
                              } catch (err: unknown) {
                                setError(
                                  getErrorMessage(err, "Failed to resend email. Please try again.")
                                );
                              }
                            }}
                          >
                            Resend email
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="signup-email" className="text-sm font-medium">
                      Email
                    </Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="you@example.com"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      className="h-11"
                      disabled={isLoading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-password-pc" className="text-sm font-medium">
                      Password
                    </Label>
                    <Input
                      id="signup-password-pc"
                      type="password"
                      placeholder="••••••••"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      className="h-11"
                      disabled={isLoading}
                    />
                    <p className="text-xs text-muted-foreground">Must be at least 8 characters</p>
                  </div>

                  <div className="flex items-start gap-2">
                    <input
                      id="age-confirm"
                      type="checkbox"
                      checked={ageConfirmed}
                      onChange={(e) => setAgeConfirmed(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-border bg-background"
                      disabled={isLoading}
                    />
                    <Label htmlFor="age-confirm" className="text-xs text-muted-foreground">
                      I confirm that I am at least 18 years old and allowed to view adult content in
                      my jurisdiction.
                    </Label>
                  </div>

                  <Button
                    type="button"
                    variant="gradient"
                    className="w-full h-12 text-base font-medium rounded-xl"
                    disabled={isLoading}
                    onClick={async () => {
                      devLog("[auth] ====== BUTTON CLICKED ======");
                      devLog("[auth] Current state:", {
                        signupEmail,
                        hasPassword: !!signupPassword,
                        ageConfirmed,
                        isLoading,
                      });

                      // 手动触发表单提交逻辑
                      setError(null);
                      setInfo(null);
                      setIsLoading(true);
                      devLog("[auth] After setIsLoading(true)");

                      if (!ageConfirmed) {
                        devLog("[auth] Age not confirmed");
                        setError("You must confirm that you are 18+ to use this platform.");
                        setIsLoading(false);
                        return;
                      }

                      const validationError = validateEmailPassword(signupEmail, signupPassword);
                      if (validationError) {
                        devLog("[auth] Validation error:", validationError);
                        setError(validationError);
                        setIsLoading(false);
                        return;
                      }

                      try {
                        const result = await signUpWithEmail(signupEmail, signupPassword);

                        devLog("[auth] Signup result:", {
                          hasUser: !!result?.user,
                          hasSession: !!result?.session,
                          userId: result?.user?.id || "none",
                        });

                        // 保存邮箱到 localStorage，方便 resend
                        localStorage.setItem("pending_signup_email", signupEmail);

                        // 按 session 真实状态走
                        if (result?.session) {
                          devLog("[auth] Session exists, redirecting to /home");
                          // 如果 data.session 存在：立刻 ensureProfile() 然后跳转到 /home (unconditionally)
                          // 不等待 ensureProfile 完成，直接跳转（profile 可以在后台创建）
                          ensureProfile().catch((err) => {
                            console.error("[auth] ensureProfile error (non-blocking):", err);
                          });
                          localStorage.removeItem("pending_signup_email");
                          // 使用 window.location.href 强制页面刷新，确保 Server Component 正确读取 session
                          // 直接使用 window.location.href 是最可靠的方式，在测试和生产环境中都能正常工作
                          devLog("[auth] Setting window.location.href to /home");
                          window.location.href = "/home";
                          devLog("[auth] window.location.href set, waiting for navigation...");
                          // 给一点时间让导航开始
                          await new Promise((resolve) => setTimeout(resolve, 100));
                          return; // 立即返回，不执行 finally 中的 setIsLoading(false)
                        } else if (result?.user) {
                          devLog(
                            "[auth] User exists but no session, showing email verification message"
                          );
                          // 如果 data.session 不存在：显示 "Check your email…" 卡片，并引导去 /auth/verify（保留但不阻塞）
                          setInfo(
                            "Check your email for a confirmation link. After confirming, you can log in."
                          );
                        } else {
                          // 既没有 session 也没有 user（理论上不应该发生）
                          setInfo(
                            "Registration request sent. Please check your email for a confirmation link."
                          );
                        }
                      } catch (err: unknown) {
                        console.error("[auth] Signup error:", err);
                        setError(getErrorMessage(err, "Signup failed. Please try again."));
                      } finally {
                        setIsLoading(false);
                      }
                    }}
                  >
                    {isLoading ? "Please wait..." : "Sign up with email"}
                  </Button>

                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-[#1F1F1F]" />
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="px-3 bg-[#0D0D0D] text-muted-foreground">
                        or continue with
                      </span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-12 text-base font-medium bg-[#0D0D0D] border-[#1F1F1F] hover:bg-[#1A1A1A] rounded-xl"
                    onClick={handleGoogleAuth}
                    disabled={isLoading}
                  >
                    <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53	H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="currentColor"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    Continue with Google
                  </Button>

                  <p className="text-xs text-muted-foreground text-center mt-4">
                    By signing up, you agree to our Terms of Service and Privacy Policy. This is an
                    adults-only platform.
                  </p>
                </form>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* MB: 垂直布局 */}
      <div className="lg:hidden w-full max-w-md space-y-6">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-primary-gradient bg-primary-gradient bg-clip-text text-transparent">
            GetFanSee
          </h1>
          <p className="text-sm text-muted-foreground px-4">
            Adult creator subscription platform. By continuing, you confirm you are at least 18
            years old.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6 bg-[#0D0D0D] border border-[#1F1F1F] rounded-xl p-1">
            <TabsTrigger
              value="login"
              className={`text-base rounded-lg transition-all ${
                activeTab === "login"
                  ? "bg-primary-gradient text-white shadow-primary-glow"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Log in
            </TabsTrigger>
            <TabsTrigger
              value="signup"
              className={`text-base rounded-lg transition-all ${
                activeTab === "signup"
                  ? "bg-primary-gradient text-white shadow-primary-glow"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sign up
            </TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <div className="bg-white/5 backdrop-blur-xl border border-[#1F1F1F] rounded-3xl p-6 space-y-6">
              <h2 className="text-xl font-semibold text-foreground">Welcome back</h2>
              <p className="text-xs text-muted-foreground">
                Use your email and password to continue. We never share your credentials with
                creators.
              </p>

              <form onSubmit={handleLoginSubmit} className="space-y-6">
                {error && (
                  <div className="bg-[#F43F5E]/10 border border-[#F43F5E]/20 text-[#F43F5E] text-sm px-4 py-3 rounded-xl">
                    {error}
                  </div>
                )}
                {info && (
                  <div className="bg-[#0D0D0D] border border-[#1F1F1F] text-xs text-foreground px-4 py-3 rounded-xl">
                    {info}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="login-email" className="text-sm font-medium">
                    Email
                  </Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="you@example.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="h-12 bg-[#0D0D0D] border-[#1F1F1F] rounded-xl"
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="login-password-mobile" className="text-sm font-medium">
                    Password
                  </Label>
                  <Input
                    id="login-password-mobile"
                    type="password"
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="h-12 bg-[#0D0D0D] border-[#1F1F1F] rounded-xl"
                    disabled={isLoading}
                  />
                </div>

                <Button
                  type="submit"
                  variant="gradient"
                  className="w-full h-12 text-base font-medium rounded-xl"
                  disabled={isLoading}
                >
                  {isLoading ? "Please wait..." : "Continue"}
                </Button>

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-[#1F1F1F]" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="px-3 bg-[#0D0D0D] text-muted-foreground">
                      or continue with
                    </span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-12 text-base font-medium bg-[#0D0D0D] border-[#1F1F1F] hover:bg-[#1A1A1A] rounded-xl"
                  onClick={handleGoogleAuth}
                  disabled={isLoading}
                >
                  <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Continue with Google
                </Button>
              </form>
            </div>
          </TabsContent>

          <TabsContent value="signup">
            <div className="bg-white/5 backdrop-blur-xl border border-[#1F1F1F] rounded-3xl p-6 space-y-6">
              <h2 className="text-2xl font-semibold text-foreground mb-1">Create your account</h2>
              <p className="text-xs text-muted-foreground">
                This is an adults-only platform. You must be 18+ to sign up. We require email
                verification before you can unlock or publish content.
              </p>

              <form onSubmit={handleSignupSubmit} className="space-y-6">
                {error && (
                  <div className="bg-[#F43F5E]/10 border border-[#F43F5E]/20 text-[#F43F5E] text-sm px-4 py-3 rounded-xl">
                    {error}
                  </div>
                )}
                {info && (
                  <div className="bg-[#10B981]/10 border border-[#10B981]/20 text-[#10B981] text-sm px-4 py-3 rounded-xl space-y-3">
                    <p>{info}</p>
                    {info.includes("Check your email") && (
                      <div className="flex flex-col gap-2 pt-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full bg-[#0D0D0D] border-[#1F1F1F] rounded-xl"
                          onClick={() => {
                            window.open("https://mail.google.com", "_blank");
                            setTimeout(() => {
                              router.push("/auth/verify");
                            }, 1000);
                          }}
                        >
                          Open Gmail / I've confirmed
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="w-full text-xs rounded-xl"
                          onClick={async () => {
                            try {
                              const { error } = await supabase.auth.resend({
                                type: "signup",
                                email: signupEmail,
                                options: {
                                  emailRedirectTo: `${window.location.origin}/auth/verify`,
                                },
                              });
                              if (error) throw error;
                              setInfo("Verification email resent! Please check your inbox.");
                            } catch (err: unknown) {
                              setError(
                                getErrorMessage(err, "Failed to resend email. Please try again.")
                              );
                            }
                          }}
                        >
                          Resend email
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="signup-email" className="text-sm font-medium">
                    Email
                  </Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="you@example.com"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    className="h-12 bg-[#0D0D0D] border-[#1F1F1F] rounded-xl"
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-password-mobile" className="text-sm font-medium">
                    Password
                  </Label>
                  <Input
                    id="signup-password-mobile"
                    type="password"
                    placeholder="••••••••"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    className="h-12 bg-[#0D0D0D] border-[#1F1F1F] rounded-xl"
                    disabled={isLoading}
                  />
                  <p className="text-xs text-muted-foreground">Must be at least 8 characters</p>
                </div>

                <div className="flex items-start gap-3">
                  <input
                    id="age-confirm"
                    type="checkbox"
                    checked={ageConfirmed}
                    onChange={(e) => setAgeConfirmed(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-[#1F1F1F] bg-[#0D0D0D] accent-[#6366F1]"
                    disabled={isLoading}
                  />
                  <Label htmlFor="age-confirm" className="text-xs text-muted-foreground">
                    I confirm that I am at least 18 years old and allowed to view adult content in
                    my jurisdiction.
                  </Label>
                </div>

                <Button
                  type="button"
                  variant="gradient"
                  className="w-full h-12 text-base font-medium rounded-xl"
                  disabled={isLoading}
                  onClick={async () => {
                    devLog("[auth] ====== BUTTON CLICKED ======");
                    devLog("[auth] Current state:", {
                      signupEmail,
                      hasPassword: !!signupPassword,
                      ageConfirmed,
                      isLoading,
                    });

                    setError(null);
                    setInfo(null);
                    setIsLoading(true);

                    if (!ageConfirmed) {
                      setError("You must confirm that you are 18+ to use this platform.");
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

                      devLog("[auth] Signup result (mobile):", {
                        hasUser: !!result?.user,
                        hasSession: !!result?.session,
                        userId: result?.user?.id || "none",
                      });

                      localStorage.setItem("pending_signup_email", signupEmail);

                      if (result?.session) {
                        devLog("[auth] Session exists (mobile), redirecting to /home");
                        // 不等待 ensureProfile 完成，直接跳转（profile 可以在后台创建）
                        ensureProfile().catch((err) => {
                          console.error("[auth] ensureProfile error (non-blocking):", err);
                        });
                        localStorage.removeItem("pending_signup_email");
                        // 使用 window.location.href 强制页面刷新，确保 Server Component 正确读取 session
                        // 直接使用 window.location.href 是最可靠的方式，在测试和生产环境中都能正常工作
                        devLog("[auth] Setting window.location.href to /home (mobile)");
                        window.location.href = "/home";
                        devLog(
                          "[auth] window.location.href set (mobile), waiting for navigation..."
                        );
                        // 给一点时间让导航开始
                        await new Promise((resolve) => setTimeout(resolve, 100));
                        return;
                      } else if (result?.user) {
                        devLog(
                          "[auth] User exists but no session (mobile), showing email verification message"
                        );
                        setInfo(
                          "Check your email for a confirmation link. After confirming, you can log in."
                        );
                      } else {
                        setInfo(
                          "Registration request sent. Please check your email for a confirmation link."
                        );
                      }
                    } catch (err: unknown) {
                      console.error("[auth] Signup error:", err);
                      setError(getErrorMessage(err, "Signup failed. Please try again."));
                    } finally {
                      setIsLoading(false);
                    }
                  }}
                >
                  {isLoading ? "Please wait..." : "Sign up with email"}
                </Button>

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-[#1F1F1F]" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="px-3 bg-[#0D0D0D] text-muted-foreground">
                      or continue with
                    </span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-12 text-base font-medium bg-[#0D0D0D] border-[#1F1F1F] hover:bg-[#1A1A1A] rounded-xl"
                  onClick={handleGoogleAuth}
                  disabled={isLoading}
                >
                  <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Continue with Google
                </Button>

                <p className="text-xs text-muted-foreground text-center mt-4">
                  By signing up, you agree to our Terms of Service and Privacy Policy. This is an
                  adults-only platform.
                </p>
              </form>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
