import { NextResponse } from "next/server";
import { listFeed } from "@/lib/posts";
import { requireAdmin } from "@/lib/authz";
import { jsonError } from "@/lib/http-errors";

export async function GET(request: Request) {
  try {
    // 使用统一的权限 Gate
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");

    // 获取 feed 数据（管理员可以看到所有内容，包括已删除的）
    const posts = await listFeed(limit);

    return NextResponse.json({ posts });
  } catch (err: unknown) {
    console.error("[api] admin posts error:", err);
    return jsonError(err);
  }
}
