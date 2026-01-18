"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";

const AGE_VERIFIED_KEY = "getfansee_age_verified";
const AGE_VERIFIED_VALUE = "true";

// Routes that don't require age verification
const EXEMPT_ROUTES = ["/age-denied", "/terms", "/privacy", "/dmca"];

interface AgeGateProps {
  children: React.ReactNode;
}

export function AgeGate({ children }: AgeGateProps) {
  const [isVerified, setIsVerified] = useState<boolean | null>(null);
  const [showDenied, setShowDenied] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // Check if current route is exempt
  const isExemptRoute = EXEMPT_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );

  useEffect(() => {
    // Check localStorage on mount
    const verified = localStorage.getItem(AGE_VERIFIED_KEY) === AGE_VERIFIED_VALUE;
    setIsVerified(verified);
  }, []);

  const handleConfirmAge = () => {
    localStorage.setItem(AGE_VERIFIED_KEY, AGE_VERIFIED_VALUE);
    setIsVerified(true);
  };

  const handleDenyAge = () => {
    setShowDenied(true);
  };

  // Still loading
  if (isVerified === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Exempt routes don't need verification
  if (isExemptRoute) {
    return <>{children}</>;
  }

  // User denied age - show blocked message
  if (showDenied) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md text-center space-y-4" data-testid="age-denied-message">
          <ShieldAlert className="w-16 h-16 mx-auto text-destructive" />
          <h1 className="text-2xl font-bold text-foreground">Access Denied</h1>
          <p className="text-muted-foreground">
            You must be 18 years or older to access this website. This site contains adult content
            that is not suitable for minors.
          </p>
          <p className="text-sm text-muted-foreground">
            If you believe you received this message in error, please close this browser window and
            try again.
          </p>
        </div>
      </div>
    );
  }

  // User not verified - show age gate modal
  if (!isVerified) {
    return (
      <>
        {/* Show blurred/hidden content behind */}
        <div className="min-h-screen bg-background opacity-20 pointer-events-none">{children}</div>

        <AlertDialog open={true}>
          <AlertDialogContent className="max-w-md" data-testid="age-gate-modal">
            <AlertDialogHeader className="text-center sm:text-center">
              <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <ShieldAlert className="w-8 h-8 text-primary" />
              </div>
              <AlertDialogTitle className="text-xl">Age Verification Required</AlertDialogTitle>
              <AlertDialogDescription className="space-y-3">
                <p>
                  This website contains adult content and is intended for individuals who are 18
                  years of age or older.
                </p>
                <p className="font-medium text-foreground">Are you at least 18 years old?</p>
              </AlertDialogDescription>
            </AlertDialogHeader>

            <AlertDialogFooter className="sm:justify-center gap-3 mt-4">
              <Button
                variant="outline"
                onClick={handleDenyAge}
                className="min-w-[120px]"
                data-testid="age-gate-no"
              >
                No, I am under 18
              </Button>
              <Button
                onClick={handleConfirmAge}
                className="min-w-[120px]"
                data-testid="age-gate-yes"
              >
                Yes, I am 18+
              </Button>
            </AlertDialogFooter>

            <div className="mt-4 pt-4 border-t text-center">
              <p className="text-xs text-muted-foreground">
                By clicking "Yes, I am 18+", you confirm that you are of legal age to view adult
                content in your jurisdiction and agree to our{" "}
                <a href="/terms" className="underline hover:text-foreground">
                  Terms of Service
                </a>{" "}
                and{" "}
                <a href="/privacy" className="underline hover:text-foreground">
                  Privacy Policy
                </a>
                .
              </p>
            </div>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  // User verified - show content
  return <>{children}</>;
}
