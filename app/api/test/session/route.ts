import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const headerFlag = request.headers.get("x-test-mode") === "1";
  if (process.env.NEXT_PUBLIC_TEST_MODE !== "true" && !headerFlag) {
    return NextResponse.json({ error: "Test mode disabled" }, { status: 403 });
  }

  const { access_token, refresh_token, expires_in = 3600 } = await request.json();
  if (!access_token || !refresh_token) {
    return NextResponse.json({ error: "Missing tokens" }, { status: 400 });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set("playwright-test-mode", "1", {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
  });
  const maxAge = Number(expires_in);

  response.cookies.set("sb-access-token", access_token, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    maxAge,
  });

  response.cookies.set("sb-refresh-token", refresh_token, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    maxAge: maxAge * 4,
  });

  return response;
}
