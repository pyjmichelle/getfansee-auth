import { NextResponse } from "next/server";
import { listFeed } from "@/lib/posts";
import { getCurrentUser } from "@/lib/auth-server";
import { getProfile } from "@/lib/profile-server";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 检查是否为管理员（这里简化处理，实际应该检查 admin 角色）
    const profile = await getProfile(user.id);
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // TODO: 实际应该检查 profile.role === 'admin'
    // 暂时允许所有用户访问，实际应该添加权限检查

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");

    // 获取 feed 数据（管理员可以看到所有内容，包括已删除的）
    const posts = await listFeed(limit);

    return NextResponse.json({ posts });
  } catch (err: unknown) {
    console.error("[api] admin posts error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
