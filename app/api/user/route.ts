import { NextRequest, NextResponse } from "next/server";
import { getProfile } from "@/lib/profile-server";
import { withAuth, serverError } from "@/lib/route-handler";

/**
 * GET /api/user
 * 获取当前用户信息（包含 profile）
 */
export const GET = withAuth(async (_request: NextRequest, { user }) => {
  try {
    const profile = await getProfile(user.id);

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
      },
      profile: profile ?? null,
    });
  } catch (err: unknown) {
    console.error("[api] user GET error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return serverError(message);
  }
});
