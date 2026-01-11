import { NextRequest, NextResponse } from "next/server";
import { ensureProfile } from "@/lib/auth-server";
import { getCurrentUser } from "@/lib/auth-server";

/**
 * POST /api/auth/ensure-profile
 * 确保当前用户的 profile 存在
 */
export async function POST(_request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await ensureProfile();

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("[api] ensure-profile error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
