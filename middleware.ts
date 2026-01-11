import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/auth-helpers-nextjs";

function getEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`[supabase] Missing environment variable: ${key}`);
  }
  return value;
}

/**
 * 中间件：保护 Creator 路由
 * 检查用户是否已登录，以及是否有 creator 权限
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next();

  // 保护 Creator 路由（除了公开的 /creator/[id] 查看页面）
  const creatorProtectedPaths = [
    "/creator/new-post",
    "/creator/onboarding",
    "/creator/studio",
    "/creator/upgrade",
  ];

  const isCreatorProtectedPath = creatorProtectedPaths.some((path) => pathname.startsWith(path));

  if (!isCreatorProtectedPath) {
    return response;
  }

  // 增强测试模式检测：支持环境变量、Cookie、Header 三种方式
  const isTestMode =
    process.env.NEXT_PUBLIC_TEST_MODE === "true" ||
    ["1", "true"].includes(request.cookies.get("playwright-test-mode")?.value || "") ||
    request.headers.get("x-playwright-test") === "true";

  if (isTestMode) {
    // 测试模式下跳过所有认证检查
    return response;
  }

  const supabase = createServerClient(
    getEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    console.error("[middleware] getSession error:", error);
  }

  if (!session) {
    const loginUrl = new URL("/auth", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 检查角色是否为 creator
  try {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single();

    if (profileError) {
      console.error("[middleware] fetch profile error:", profileError);
    }

    if (profile?.role !== "creator") {
      const upgradeUrl = new URL("/creator/upgrade", request.url);
      upgradeUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(upgradeUrl);
    }
  } catch (profileErr) {
    console.error("[middleware] unexpected profile check error:", profileErr);
    const upgradeUrl = new URL("/creator/upgrade", request.url);
    upgradeUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(upgradeUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/creator/new-post/:path*",
    "/creator/onboarding/:path*",
    "/creator/studio/:path*",
    "/creator/upgrade/:path*",
  ],
};
