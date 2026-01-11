import { NextRequest, NextResponse } from "next/server";
import { getCreator } from "@/lib/creators";
import { getCurrentUser } from "@/lib/auth-server";

/**
 * GET /api/creator/[id]
 * 获取指定 creator 的信息
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // 检查认证（可选，creator 信息可以公开）
    await getCurrentUser();

    const { id } = await params;
    const creator = await getCreator(id);

    if (!creator) {
      return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    }

    return NextResponse.json({ creator });
  } catch (err: unknown) {
    console.error("[api] creator GET error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
