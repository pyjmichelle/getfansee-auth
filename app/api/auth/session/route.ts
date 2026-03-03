import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

// Session cookie sync endpoint: called by the client after Supabase JS login
// to persist the session token in httpOnly cookies for SSR.
// Security: validates the access_token against Supabase before setting cookies.

type SessionPayload = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
};

export async function POST(request: NextRequest) {
  try {
    const {
      access_token,
      refresh_token,
      expires_in = 3600,
    } = (await request.json()) as SessionPayload;

    if (!access_token || !refresh_token) {
      return NextResponse.json({ error: "Missing tokens" }, { status: 400 });
    }

    // Basic JWT structure check (header.payload.signature)
    const jwtPattern = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
    if (!jwtPattern.test(access_token)) {
      return NextResponse.json({ error: "Invalid token format" }, { status: 400 });
    }

    // Server-side token validation: reject tokens not issued by our Supabase instance
    const admin = getSupabaseAdminClient();
    const { data: userData, error: verifyError } = await admin.auth.getUser(access_token);
    if (verifyError || !userData?.user?.id) {
      return NextResponse.json({ error: "Token verification failed" }, { status: 401 });
    }

    const safeMaxAge = Math.min(Math.max(Number(expires_in) || 3600, 60), 86400);
    const isSecure =
      request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";

    const response = NextResponse.json({ success: true });

    response.cookies.set("sb-access-token", access_token, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: isSecure,
      maxAge: safeMaxAge,
    });

    response.cookies.set("sb-refresh-token", refresh_token, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: isSecure,
      maxAge: safeMaxAge * 4,
    });

    return response;
  } catch (err: unknown) {
    console.error("[api/auth/session] error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
