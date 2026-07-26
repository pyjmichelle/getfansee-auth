import { NextRequest, NextResponse } from "next/server";
import { updateCreatorProfile } from "@/lib/profile-server";
import { getCurrentUser } from "@/lib/auth-server";

type CreatorProfileUpdatePayload = {
  display_name?: string;
  bio?: string;
  avatar_url?: string;
  category?: string | null;
};

/**
 * PUT /api/profile/update
 * 更新当前用户的 creator profile
 */
export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as CreatorProfileUpdatePayload;
    const { display_name, bio, avatar_url, category } = body;

    if (category !== undefined && category !== null && String(category).length > 40) {
      return NextResponse.json({ error: "Category is too long" }, { status: 400 });
    }

    const success = await updateCreatorProfile({
      userId: user.id,
      display_name,
      bio,
      avatar_url,
      category,
    });

    if (!success) {
      return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("[api] profile update error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
