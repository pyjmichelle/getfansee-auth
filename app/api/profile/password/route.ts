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

    // P1 安全修复：updatePassword 现在返回更详细的结果
    const result = await updatePassword(user.id, oldPassword, newPassword);

    if (!result.success) {
      // 根据错误类型返回适当的状态码
      const status = result.error === "Current password is incorrect" ? 401 : 400;
      return NextResponse.json({ error: result.error || "Failed to update password" }, { status });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("[api] profile password update error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
