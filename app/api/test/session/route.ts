import { NextResponse } from "next/server";
import { getSupabaseRouteHandlerClient } from "@/lib/supabase-route";

/**
 * E2E 测试专用：由服务端用与线上相同的 createServerClient 登录并 set-cookie，
 * 保证 cookie name / chunking / options 与 auth-helpers 一致，避免 "Auth Session Missing"。
 * 仅在测试环境启用；返回 204，不向前端返回 token。
 */
export async function POST(request: Request) {
  /** CI/E2E 唯一门控：仅 E2E 与 PLAYWRIGHT_TEST_MODE，不依赖 NEXT_PUBLIC_TEST_MODE */
  const isTestEnv = process.env.E2E === "1" || process.env.PLAYWRIGHT_TEST_MODE === "true";

  if (!isTestEnv) {
    return new NextResponse("Not Found", { status: 404 });
  }

  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { email, password } = body;
  if (!email || !password) {
    return NextResponse.json({ error: "Missing email or password" }, { status: 400 });
  }

  const supabase = await getSupabaseRouteHandlerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  return new NextResponse(null, { status: 204 });
}
