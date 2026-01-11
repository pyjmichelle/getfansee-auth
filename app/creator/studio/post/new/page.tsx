"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function StudioNewPostRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/creator/new-post");
  }, [router]);

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <p className="text-sm text-muted-foreground">Redirecting to the latest publisher...</p>
    </div>
  );
}
