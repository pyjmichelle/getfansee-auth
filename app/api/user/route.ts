import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-server";
import { getProfile } from "@/lib/profile-server";

/**
 * GET /api/user
 * 获取当前用户信息（包含 profile）
 */
export async function GET(_request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await getProfile(user.id);

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
      },
      profile: profile || null,
    });
  } catch (err: unknown) {
    console.error("[api] user GET error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
