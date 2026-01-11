import { NextRequest, NextResponse } from "next/server";
import { updateProfile } from "@/lib/profile-server";
import { getCurrentUser } from "@/lib/auth-server";

type ProfileUpdatePayload = {
  display_name?: string;
  bio?: string;
  avatar_url?: string;
};

/**
 * PUT /api/profile/general
 * 更新当前用户的通用 profile 信息
 */
export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as ProfileUpdatePayload;
    const { display_name, bio, avatar_url } = body;

    const success = await updateProfile(user.id, {
      display_name,
      bio,
      avatar_url,
    });

    if (!success) {
      return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("[api] profile general update error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
