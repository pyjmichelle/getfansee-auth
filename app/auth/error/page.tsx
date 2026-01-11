import { AlertCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

type AuthErrorPageProps = {
  searchParams: {
    error?: string | string[];
  };
};

export default function AuthErrorPage({ searchParams }: AuthErrorPageProps) {
  const modeParam = searchParams?.error ?? null;
  const error = typeof modeParam === "string" ? modeParam : null;

  const getErrorMessage = (errorCode: string | null) => {
    switch (errorCode) {
      case "account_not_verified":
        return {
          title: "Account Not Verified",
          message:
            "Please verify your email address before logging in. Check your inbox for the verification link.",
          action: { text: "Resend Verification Email", href: "/auth/resend-verification" },
        };
      case "invalid_credentials":
        return {
          title: "Invalid Credentials",
          message: "The email or password you entered is incorrect. Please try again.",
          action: { text: "Try Again", href: "/auth" },
        };
      case "oauth_failed":
        return {
          title: "Authentication Failed",
          message:
            "We couldn't authenticate you with Google. Please try again or use email/password.",
          action: { text: "Back to Login", href: "/auth" },
        };
      case "account_suspended":
        return {
          title: "Account Suspended",
          message:
            "Your account has been suspended due to a violation of our terms of service. Please contact support.",
          action: { text: "Contact Support", href: "/support" },
        };
      default:
        return {
          title: "Something Went Wrong",
          message:
            "An unexpected error occurred. Please try again or contact support if the problem persists.",
          action: { text: "Back to Login", href: "/auth" },
        };
    }
  };

  const errorInfo = getErrorMessage(error);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md">
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground mb-3">{errorInfo.title}</h1>
          <p className="text-muted-foreground mb-6">{errorInfo.message}</p>
          <div className="space-y-3">
            <Button asChild className="w-full">
              <Link href={errorInfo.action.href}>{errorInfo.action.text}</Link>
            </Button>
            {error === "account_not_verified" && (
              <Button asChild variant="outline" className="w-full bg-transparent">
                <Link href="/auth">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Login
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
