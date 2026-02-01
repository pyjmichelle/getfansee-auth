"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ensureProfile } from "@/lib/auth";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

const supabase = getSupabaseBrowserClient();

const devLog = (...args: unknown[]) => {
  if (process.env.NODE_ENV === "development") {
    console.warn("[verify]", ...args);
  }
};

type VerifyPageClientProps = {
  query: {
    code?: string;
    token?: string;
    type?: string;
    error?: string;
    error_description?: string;
    email?: string;
  };
};

/**
 * 从 URL hash 中解析参数（兼容旧格式）
 * Supabase 有时会将参数放在 hash 中，如：#error=access_denied&error_code=otp_expired
 */
function parseHashParams(): Record<string, string> {
  if (typeof window === "undefined") return {};

  const hash = window.location.hash.substring(1); // 移除 #
  const params: Record<string, string> = {};

  if (hash) {
    hash.split("&").forEach((param) => {
      const [key, value] = param.split("=");
      if (key && value) {
        params[key] = decodeURIComponent(value);
      }
    });
  }

  return params;
}

export default function VerifyPageClient({ query }: VerifyPageClientProps) {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const [canResend, setCanResend] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const handleVerification = async () => {
      try {
        // 1. 优先从 query string 获取参数
        const queryCode = query.code ?? null;
        const queryToken = query.token ?? null;
        const queryType = query.type ?? null;
        const queryError = query.error ?? null;
        const queryErrorDescription = query.error_description ?? null;
        const queryEmail = query.email ?? null;

        // 2. 从 hash 中获取参数（兼容旧格式）
        const hashParams = parseHashParams();
        const hashCode = hashParams.code;
        const hashError = hashParams.error;
        const hashErrorCode = hashParams.error_code;
        const hashErrorDescription = hashParams.error_description;

        // 3. 合并参数（query string 优先）
        const code = queryCode || hashCode;
        const token = queryToken;
        const type = queryType;
        const error = queryError || hashError;
        const errorCode = hashErrorCode;
        const errorDescription = queryErrorDescription || hashErrorDescription;
        let email = queryEmail;
        if (!email && typeof window !== "undefined") {
          try {
            email = localStorage.getItem("pending_signup_email");
          } catch {
            /* SecurityError in cross-origin or restricted contexts; ignore */
          }
        }

        if (email) {
          setUserEmail(email);
        }

        devLog("URL parameters:", {
          code: code ? "present" : "missing",
          token: token ? "present" : "missing",
          type,
          error,
          errorCode,
          errorDescription,
          email,
        });

        // 4. 优先处理错误（包括过期链接）
        if (error) {
          console.error("[verify] Error in URL:", { error, errorCode, errorDescription });
          setStatus("error");

          // 处理特定错误类型
          if (errorCode === "otp_expired" || error === "otp_expired") {
            setMessage("Email link has expired. Please request a new verification email.");
          } else if (error === "access_denied") {
            setMessage("Access denied. The verification link is invalid or has expired.");
          } else {
            setMessage(errorDescription || error || "Authentication failed. Please try again.");
          }

          setCanResend(true);
          return;
        }

        // 5. 优先处理 code（邮箱验证的新格式，Supabase 推荐）
        if (code) {
          devLog("Processing code exchange");
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

          if (exchangeError) {
            console.error("[verify] Code exchange error:", exchangeError);
            setStatus("error");

            if (
              exchangeError.message.includes("expired") ||
              exchangeError.message.includes("invalid")
            ) {
              setMessage("Verification link has expired or is invalid. Please request a new one.");
            } else {
              setMessage("Failed to complete verification. Please try again.");
            }

            setCanResend(true);
            return;
          }

          if (data?.session?.user) {
            devLog("Code exchange successful, user:", data.session.user.email);
            // 获取 user 后立刻 ensureProfile 并重定向 (unconditionally)
            await ensureProfile();
            router.replace("/home");
            return;
          } else {
            console.error("[verify] Code exchange succeeded but no session/user");
            setStatus("error");
            setMessage("Verification completed, but session not found. Please try logging in.");
            setCanResend(true);
            return;
          }
        }

        // 6. 处理 email verification token（旧格式，兼容）
        if (token && type) {
          devLog("Processing email verification token", { type });

          let verifyResult;
          if (type === "signup" || type === "email") {
            verifyResult = await supabase.auth.verifyOtp({
              token_hash: token,
              type: type as "signup" | "email",
            });
          } else if (type === "magiclink") {
            verifyResult = await supabase.auth.verifyOtp({
              token_hash: token,
              type: "magiclink",
            });
          } else {
            setStatus("error");
            setMessage("Invalid verification type. Please check your email for a valid link.");
            setCanResend(true);
            return;
          }

          if (verifyResult.error) {
            console.error("[verify] verifyOtp error:", verifyResult.error);
            setStatus("error");

            if (
              verifyResult.error.message.includes("expired") ||
              verifyResult.error.message.includes("invalid")
            ) {
              setMessage("Verification link has expired or is invalid. Please request a new one.");
            } else {
              setMessage(verifyResult.error.message || "Verification failed. Please try again.");
            }

            setCanResend(true);
            return;
          }

          // 验证成功，检查 session
          const {
            data: { session },
            error: sessionError,
          } = await supabase.auth.getSession();

          if (sessionError || !session?.user) {
            console.error("[verify] No session after verification:", sessionError);
            setStatus("error");
            setMessage("Verification completed, but session not found. Please try logging in.");
            setCanResend(true);
            return;
          }

          // 有 session，创建 profile 并重定向 (unconditionally)
          devLog("Token verification successful, user:", session.user.email);
          await ensureProfile();
          router.replace("/home");
          return;
        }

        // 7. 检查是否已有 session（可能是直接访问，但已登录）
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          devLog("Already has session, user:", session.user.email);
          // 已有 session，直接创建 profile 并跳转 (unconditionally)
          await ensureProfile();
          router.replace("/home");
          return;
        }

        // 8. 没有 token、code 或 session，显示错误
        console.warn("[verify] No verification parameters found");
        setStatus("error");
        setMessage("Invalid verification link. Please check your email or try logging in.");
        setCanResend(true);
      } catch (err: unknown) {
        console.error("[verify] unexpected error", err);
        setStatus("error");
        setMessage(err instanceof Error ? err.message : "Verification failed. Please try again.");
        setCanResend(true);
      }
    };

    handleVerification();
  }, [
    router,
    query.code,
    query.token,
    query.type,
    query.error,
    query.error_description,
    query.email,
  ]);

  const handleResend = async () => {
    let email = userEmail;
    if (!email && typeof window !== "undefined") {
      try {
        email = localStorage.getItem("pending_signup_email");
      } catch {
        /* SecurityError in cross-origin or restricted contexts; ignore */
      }
    }

    if (!email) {
      router.push("/auth/resend-verification");
      return;
    }

    try {
      devLog("Resending verification email to:", email);
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo:
            typeof window !== "undefined" ? `${window.location.origin}/auth/verify` : undefined,
        },
      });

      if (error) {
        console.error("[verify] Resend error:", error);
        setMessage("Failed to resend email. Please try again or use the resend page.");
      } else {
        setMessage("Verification email sent! Please check your inbox.");
        setCanResend(false);
      }
    } catch (err: unknown) {
      console.error("[verify] Resend exception:", err);
      setMessage("Failed to resend email. Please try again.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md">
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          {status === "loading" && (
            <>
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
              <h1 className="text-2xl font-semibold text-foreground mb-3">Verifying...</h1>
              <p className="text-muted-foreground">Please wait while we verify your account.</p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              </div>
              <h1 className="text-2xl font-semibold text-foreground mb-3">
                Verification Successful!
              </h1>
              <p className="text-muted-foreground mb-6">{message}</p>
            </>
          )}

          {status === "error" && (
            <>
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-6">
                <XCircle className="w-8 h-8 text-destructive" />
              </div>
              <h1 className="text-2xl font-semibold text-foreground mb-3">Verification Failed</h1>
              <p className="text-muted-foreground mb-6">{message}</p>
              <div className="space-y-3">
                {canResend && (
                  <Button onClick={handleResend} className="w-full" variant="outline">
                    <Mail className="w-4 h-4 mr-2" />
                    Resend Confirmation Email
                  </Button>
                )}
                <Button
                  onClick={() => router.push("/auth")}
                  variant="outline"
                  className="w-full bg-transparent"
                >
                  Go to Login
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
