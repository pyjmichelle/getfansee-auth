import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const isTestMode =
    process.env.PLAYWRIGHT_TEST_MODE === "true" || process.env.NEXT_PUBLIC_TEST_MODE === "true";

  if (!isTestMode) {
    return NextResponse.json({ error: "Test mode disabled" }, { status: 403 });
  }

  const { access_token, refresh_token, expires_in = 3600 } = await request.json();
  if (!access_token || !refresh_token) {
    return NextResponse.json({ error: "Missing tokens" }, { status: 400 });
  }

  const response = NextResponse.json({ success: true });
  const isSecure =
    request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
  response.cookies.set("playwright-test-mode", "1", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: isSecure,
  });
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
}
