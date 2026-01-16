import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-server";
import { getPostComments, createComment } from "@/lib/comments";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

/**
 * GET /api/posts/[id]/comments
 * 获取帖子的评论列表
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id: postId } = await context.params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    console.log(
      `[GET /api/posts/${postId}/comments] User: ${user.id}, Limit: ${limit}, Offset: ${offset}`
    );

    const result = await getPostComments(postId, limit, offset);

    return NextResponse.json({
      success: true,
      comments: result.comments,
      total: result.total,
      hasMore: offset + limit < result.total,
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[GET /api/posts/[id]/comments] Error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to fetch comments",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/posts/[id]/comments
 * 创建新评论
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id: postId } = await context.params;
    const body = await request.json();
    const { content } = body;

    console.log(`[POST /api/posts/${postId}/comments] User: ${user.id}`);

    // 验证输入
    if (!content || typeof content !== "string") {
      return NextResponse.json({ success: false, error: "Content is required" }, { status: 400 });
    }

    const trimmedContent = content.trim();
    if (trimmedContent.length === 0) {
      return NextResponse.json(
        { success: false, error: "Comment cannot be empty" },
        { status: 400 }
      );
    }

    if (trimmedContent.length > 1000) {
      return NextResponse.json(
        { success: false, error: "Comment is too long (max 1000 characters)" },
        { status: 400 }
      );
    }

    // 创建评论
    const comment = await createComment(postId, user.id, trimmedContent);

    console.log(`[POST /api/posts/${postId}/comments] Comment created:`, comment.id);

    return NextResponse.json({
      success: true,
      comment,
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[POST /api/posts/[id]/comments] Error:", error);

    // 处理特定错误
    if (error.message.includes("not found")) {
      return NextResponse.json({ success: false, error: "Post not found" }, { status: 404 });
    }

    if (error.message.includes("must be subscribed")) {
      return NextResponse.json(
        {
          success: false,
          error: "You must be subscribed or have purchased this content to comment",
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to create comment",
      },
      { status: 500 }
    );
  }
}
