import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/auth-helpers-nextjs";
import { env } from "@/lib/env";

/**
 * 中间件：保护 Creator 和 Admin 路由
 * 检查用户是否已登录，以及是否有对应权限
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next();

  const isAdminPath = pathname.startsWith("/admin");
  const userProtectedPaths = ["/me", "/subscriptions", "/purchases", "/notifications"];
  const isUserProtectedPath = userProtectedPaths.some((path) => pathname.startsWith(path));

  // 保护 Creator 路由（除了公开的 /creator/[id] 查看页面）
  const creatorProtectedPaths = ["/creator/new-post", "/creator/studio"];
  const isCreatorProtectedPath = creatorProtectedPaths.some((path) => pathname.startsWith(path));

  if (!isCreatorProtectedPath && !isAdminPath && !isUserProtectedPath) {
    return response;
  }

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
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
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error("[middleware] getUser error:", error);
  }

  if (!user) {
    const loginUrl = new URL("/auth", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Admin 路由：必须是 admin 角色（只信任 app_metadata，不信任用户可自改的 user_metadata）
  if (isAdminPath) {
    let userRole: string | null = (user.app_metadata?.role as string | undefined) ?? null;
    if (!userRole) {
      try {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();

        if (profileError) {
          console.error("[middleware] fetch profile error:", profileError);
        }

        userRole = profile?.role ?? null;
      } catch (profileErr) {
        console.error("[middleware] unexpected profile check error:", profileErr);
      }
    }

    if (userRole !== "admin") {
      return NextResponse.redirect(new URL("/home", request.url));
    }
    return response;
  }

  // Creator 路由只要求登录；角色判定下沉到页面/API，减少切页时额外数据库查询。

  return response;
}

export const config = {
  matcher: [
    "/me/:path*",
    "/subscriptions/:path*",
    "/purchases/:path*",
    "/notifications/:path*",
    "/creator/new-post/:path*",
    "/creator/onboarding/:path*",
    "/creator/studio/:path*",
    "/admin/:path*",
  ],
};
