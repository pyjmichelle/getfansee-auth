"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "@/lib/icons";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin-error]", error);
  }, [error]);

  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
      <div className="mx-auto w-14 h-14 rounded-full bg-[var(--error)]/10 flex items-center justify-center">
        <AlertCircle className="w-7 h-7 text-[var(--error-text)]" />
      </div>
      <div>
        <h2 className="text-h3 font-bold text-text-primary mb-1">Admin panel failed to load</h2>
        <p className="text-small text-text-secondary">Something went wrong. Please try again.</p>
      </div>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
