import { NextRequest, NextResponse } from "next/server";
import { listFeed } from "@/lib/posts";
import { canViewPost } from "@/lib/paywall";
import { getCurrentUser } from "@/lib/auth-server";
import { getMockPostsWithCreators, shouldUseMockData } from "@/lib/mock-data";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse pagination params
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);
    const offset = parseInt(searchParams.get("offset") || "0");

    // Get feed data
    let posts = await listFeed(limit, offset);

    // If no posts and mock data is enabled, use mock posts
    if (posts.length === 0 && shouldUseMockData()) {
      const mockPosts = getMockPostsWithCreators();
      posts = mockPosts.slice(offset, offset + limit) as any;
    }

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
      pagination: {
        limit,
        offset,
        hasMore: posts.length === limit, // 如果返回数量等于 limit，可能还有更多
      },
    });
  } catch (err: unknown) {
    console.error("[api] feed error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
