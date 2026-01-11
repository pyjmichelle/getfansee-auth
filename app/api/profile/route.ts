import { NextRequest, NextResponse } from "next/server";
import { getProfile } from "@/lib/profile-server";
import { getCurrentUser } from "@/lib/auth-server";

/**
 * GET /api/profile
 * 获取当前用户的 profile 信息
 */
export async function GET(_request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await getProfile(user.id);
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    return NextResponse.json({ profile });
  } catch (err: unknown) {
    console.error("[api] profile GET error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
