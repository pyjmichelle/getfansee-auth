import { NextRequest, NextResponse } from "next/server";
import { listFeed } from "@/lib/posts";
import { canViewPost } from "@/lib/paywall";
import { getCurrentUser } from "@/lib/auth-server";
import { getMockPostsWithCreators, shouldUseMockData } from "@/lib/mock-data";
import { type Post } from "@/lib/types";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse pagination params
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 50);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // Get feed data
    let posts = await listFeed(limit, offset);

    // If no posts and mock data is enabled, use mock posts
    if (posts.length === 0 && shouldUseMockData()) {
      const mockPosts = getMockPostsWithCreators();
      posts = mockPosts.slice(offset, offset + limit) as Post[];
    }

    // 在服务端检查每个 post 的可见性状态（并行执行，避免异步瀑布流）
    const unlockedStates: Record<string, boolean> = {};

    // 先处理不需要异步检查的 posts
    const postsToCheck: Post[] = [];
    posts.forEach((post) => {
      if (post.creator_id === user.id) {
        unlockedStates[post.id] = true;
      } else if (post.visibility === "free") {
        unlockedStates[post.id] = true;
      } else {
        postsToCheck.push(post);
      }
    });

    // 并行执行所有 canViewPost 检查（使用 Promise.all 避免瀑布流）
    if (postsToCheck.length > 0) {
      const checkPromises = postsToCheck.map(async (post) => {
        try {
          const canView = await canViewPost(post.id, post.creator_id);
          return { postId: post.id, canView };
        } catch (err) {
          console.error("[api] feed canViewPost error", err);
          return { postId: post.id, canView: false };
        }
      });

      const results = await Promise.all(checkPromises);
      results.forEach(({ postId, canView }) => {
        unlockedStates[postId] = canView;
      });
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
