import { NextResponse } from "next/server";
import { listFeed } from "@/lib/posts";
import { canViewPost } from "@/lib/paywall";
import { getCurrentUser } from "@/lib/auth-server";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 获取 feed 数据
    const posts = await listFeed(20);

    // 在服务端检查每个 post 的可见性状态
    const unlockedStates: Record<string, boolean> = {};
    for (const post of posts) {
      // Creator 本人永远可见
      if (post.creator_id === user.id) {
        unlockedStates[post.id] = true;
      } else if (post.visibility === "free") {
        // 免费内容永远可见
        unlockedStates[post.id] = true;
      } else {
        // 调用服务端函数检查解锁状态
        try {
          const canView = await canViewPost(post.id, post.creator_id);
          unlockedStates[post.id] = canView;
        } catch (err) {
          console.error("[api] feed canViewPost error", err);
          unlockedStates[post.id] = false;
        }
      }
    }

    return NextResponse.json({
      posts,
      unlockedStates,
    });
  } catch (err: unknown) {
    console.error("[api] feed error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
