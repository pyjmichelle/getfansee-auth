"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function StudioNewPostRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/creator/new-post");
  }, [router]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <p className="text-sm text-text-tertiary">Redirecting to the latest publisher...</p>
    </div>
  );
}
