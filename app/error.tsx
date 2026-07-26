"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "@/lib/icons";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app-error]", error);
  }, [error]);

  return (
    <div className="min-h-dvh bg-bg-base flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-full bg-[var(--error)]/10 flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-[var(--error-text)]" />
        </div>

        <div>
          <h1 className="text-h2 font-bold text-text-primary mb-2">Something went wrong</h1>
          <p className="text-body text-text-secondary">
            We encountered an unexpected error. Please try again.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Button onClick={reset} className="w-full">
            Try again
          </Button>
          <Button variant="outline" onClick={() => (window.location.href = "/")} className="w-full">
            Go to homepage
          </Button>
        </div>

        {error.digest && <p className="text-tiny text-text-tertiary">Error ID: {error.digest}</p>}
      </div>
    </div>
  );
}
