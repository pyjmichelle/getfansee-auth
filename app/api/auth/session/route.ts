import { NextRequest, NextResponse } from "next/server";

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

    const response = NextResponse.json({ success: true });
    const isSecure =
      request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
    const maxAge = Number(expires_in);

    response.cookies.set("sb-access-token", access_token, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: isSecure,
      maxAge,
    });

    response.cookies.set("sb-refresh-token", refresh_token, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: isSecure,
      maxAge: maxAge * 4,
    });

    return response;
  } catch (err: unknown) {
    console.error("[api/auth/session] error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
