"use client"

import type React from "react"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ensureProfile, signInWithEmail, signInWithGoogle, signInWithMagicLink, signUpWithEmail } from "@/lib/auth"
import { supabase } from "@/lib/supabase-client"

export default function AuthPage() {
  const router = useRouter()

  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")
  const [signupEmail, setSignupEmail] = useState("")
  const [signupPassword, setSignupPassword] = useState("")
  const [ageConfirmed, setAgeConfirmed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const validateEmailPassword = (email: string, password: string) => {
    if (!email || !password) {
      return "Please fill in all fields"
    }
    if (!email.includes("@")) {
      return "Please enter a valid email address"
    }
    if (password.length < 8) {
      return "Password must be at least 8 characters"
    }
    return null
  }

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setIsLoading(true)

    const validationError = validateEmailPassword(loginEmail, loginPassword)
    if (validationError) {
      setError(validationError)
      setIsLoading(false)
      return
    }

    try {
      const result = await signInWithEmail(loginEmail, loginPassword)
      // 登录成功后：ensureProfile() → /home (unconditionally)
      if (result?.session) {
        await ensureProfile()
        router.push("/home")
        return // 立即返回，不执行 finally 中的 setIsLoading(false)
      } else {
        setError("Login successful but no session found. Please try again.")
      }
    } catch (err: any) {
      setError(err?.message ?? "Login failed. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignupSubmit = async (e: React.FormEvent) => {
    console.log("[auth] handleSignupSubmit called", { signupEmail, hasPassword: !!signupPassword, ageConfirmed })
    e.preventDefault()
    setError(null)
    setInfo(null)
    setIsLoading(true)
    console.log("[auth] After setIsLoading(true)")

    if (!ageConfirmed) {
      setError("You must confirm that you are 18+ to use this platform.")
      setIsLoading(false)
      return
    }

    const validationError = validateEmailPassword(signupEmail, signupPassword)
    if (validationError) {
      setError(validationError)
      setIsLoading(false)
      return
    }

    try {
      const result = await signUpWithEmail(signupEmail, signupPassword)
      console.log("[auth] Signup result:", result)
      
      // 检查 Supabase 的响应
      if (result?.user) {
        // 如果 Supabase 配置为不需要邮箱验证，立即创建 profile
        if (result.session) {
          // 有 session 说明不需要邮箱验证，立即创建 profile 并重定向 (unconditionally)
          await ensureProfile()
          router.push("/home")
          return // 立即返回，不执行 finally 中的 setIsLoading(false)
        } else {
          // 需要邮箱验证
          setInfo("Check your email for a confirmation link. After confirming, you can log in.")
        }
      } else {
        setInfo("Registration request sent. Please check your email for a confirmation link.")
      }
    } catch (err: any) {
      console.error("[auth] Signup error:", err)
      setError(err?.message ?? "Signup failed. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleMagicLink = async () => {
    setError(null)
    setInfo(null)
    setIsLoading(true)

    if (!signupEmail || !signupEmail.includes("@")) {
      setError("Please enter a valid email address")
      setIsLoading(false)
      return
    }

    try {
      await signInWithMagicLink(signupEmail)
      setInfo("Magic link sent. Please check your email to continue.")
    } catch (err: any) {
      setError(err?.message ?? "Failed to send magic link. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleAuth = async () => {
    setError(null)
    setInfo(null)
    try {
      await signInWithGoogle()
      // Supabase 会重定向回 /auth/verify，verify 页面中再 ensureProfile/redirect
    } catch (err: any) {
      setError(err?.message ?? "Google sign-in failed. Please check OAuth configuration.")
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">GetFanSee</h1>
          <p className="text-sm text-muted-foreground">
            Adult creator subscription platform. By continuing, you confirm you are at least 18 years old.
          </p>
        </div>

        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="login" className="text-base">
              Log in
            </TabsTrigger>
            <TabsTrigger value="signup" className="text-base">
              Sign up
            </TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <div className="bg-card border border-border rounded-lg p-6 space-y-4">
              <h2 className="text-xl font-semibold text-foreground">Welcome back</h2>
              <p className="text-xs text-muted-foreground">
                Use your email and password to continue. We never share your credentials with creators.
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
                  <Label htmlFor="login-password" className="text-sm font-medium">
                    Password
                  </Label>
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="h-11"
                    disabled={isLoading}
                  />
                </div>

                <Button type="submit" className="w-full h-11 text-base font-medium" disabled={isLoading}>
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
            <div className="bg-card border border-border rounded-lg p-6 space-y-4">
              <h2 className="text-2xl font-semibold text-foreground mb-1">Create your account</h2>
              <p className="text-xs text-muted-foreground">
                This is an adults-only platform. You must be 18+ to sign up. We require email verification before you
                can unlock or publish content.
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
                            window.open("https://mail.google.com", "_blank")
                            setTimeout(() => {
                              router.push("/auth/verify")
                            }, 1000)
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
                              })
                              if (error) throw error
                              setInfo("Verification email resent! Please check your inbox.")
                            } catch (err: any) {
                              setError(err?.message || "Failed to resend email. Please try again.")
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
                  <Label htmlFor="signup-password" className="text-sm font-medium">
                    Password
                  </Label>
                  <Input
                    id="signup-password"
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
                    I confirm that I am at least 18 years old and allowed to view adult content in my jurisdiction.
                  </Label>
                </div>

                <Button 
                  type="button"
                  className="w-full h-11 text-base font-medium" 
                  disabled={isLoading}
                  onClick={async () => {
                    console.log("[auth] ====== BUTTON CLICKED ======")
                    console.log("[auth] Current state:", { signupEmail, hasPassword: !!signupPassword, ageConfirmed, isLoading })
                    
                    // 手动触发表单提交逻辑
                    setError(null)
                    setInfo(null)
                    setIsLoading(true)
                    console.log("[auth] After setIsLoading(true)")

                    if (!ageConfirmed) {
                      console.log("[auth] Age not confirmed")
                      setError("You must confirm that you are 18+ to use this platform.")
                      setIsLoading(false)
                      return
                    }

                    const validationError = validateEmailPassword(signupEmail, signupPassword)
                    if (validationError) {
                      console.log("[auth] Validation error:", validationError)
                      setError(validationError)
                      setIsLoading(false)
                      return
                    }

                    try {
                      const result = await signUpWithEmail(signupEmail, signupPassword)
                      
                      // 保存邮箱到 localStorage，方便 resend
                      localStorage.setItem("pending_signup_email", signupEmail)
                      
                      // 按 session 真实状态走
                      if (result?.session) {
                        // 如果 data.session 存在：立刻 ensureProfile() 然后 router.push('/home') (unconditionally)
                        await ensureProfile()
                        localStorage.removeItem("pending_signup_email")
                        router.push("/home")
                        return // 立即返回，不执行 finally 中的 setIsLoading(false)
                      } else if (result?.user) {
                        // 如果 data.session 不存在：显示 "Check your email…" 卡片，并引导去 /auth/verify（保留但不阻塞）
                        setInfo("Check your email for a confirmation link. After confirming, you can log in.")
                      } else {
                        // 既没有 session 也没有 user（理论上不应该发生）
                        setInfo("Registration request sent. Please check your email for a confirmation link.")
                      }
                    } catch (err: any) {
                      console.error("[auth] Signup error:", err)
                      setError(err?.message ?? "Signup failed. Please try again.")
                    } finally {
                      setIsLoading(false)
                    }
                  }}
                >
                  {isLoading ? "Please wait..." : "Sign up with email"}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-11 text-sm font-medium bg-transparent"
                  onClick={handleMagicLink}
                  disabled={isLoading}
                >
                  Send magic link to my email
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
                  By signing up, you agree to our Terms of Service and Privacy Policy. This is an adults-only platform.
                </p>
              </form>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}


