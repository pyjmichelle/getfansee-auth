"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { initPostHog, posthog } from "@/lib/posthog";

interface PostHogProviderProps {
  children: React.ReactNode;
}

/**
 * PostHog Provider
 * 负责初始化 PostHog 并自动追踪页面浏览事件
 */
export function PostHogProvider({ children }: PostHogProviderProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialized = useRef(false);

  // 初始化 PostHog（只执行一次）
  useEffect(() => {
    if (!initialized.current) {
      initPostHog();
      initialized.current = true;
    }
  }, []);

  // 路由变化时自动追踪页面浏览
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;

    const searchString = searchParams?.toString() ?? "";
    const url = pathname + (searchString ? `?${searchString}` : "");

    posthog.capture("$pageview", {
      $current_url: window.location.origin + url,
    });
  }, [pathname, searchParams]);

  return <>{children}</>;
}
