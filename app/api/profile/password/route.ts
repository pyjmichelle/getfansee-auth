import { NextRequest, NextResponse } from "next/server";
import { updatePassword } from "@/lib/profile-server";
import { getCurrentUser } from "@/lib/auth-server";

type PasswordUpdatePayload = {
  oldPassword?: string;
  newPassword?: string;
};

/**
 * PUT /api/profile/password
 * 更新当前用户的密码
 */
export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as PasswordUpdatePayload;
    const { oldPassword, newPassword } = body;

    if (!oldPassword || !newPassword) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const success = await updatePassword(user.id, oldPassword, newPassword);

    if (!success) {
      return NextResponse.json({ error: "Failed to update password" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("[api] profile password update error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
