import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-server";
import { deleteComment } from "@/lib/comments";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

/**
 * DELETE /api/comments/[id]
 * 删除评论
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id: commentId } = await context.params;

    // Removed debug console.log - vercel-react-best-practices
    await deleteComment(commentId, user.id);

    return NextResponse.json({
      success: true,
      message: "Comment deleted successfully",
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[DELETE /api/comments/[id]] Error:", error);

    // 处理特定错误
    if (error.message.includes("not found")) {
      return NextResponse.json({ success: false, error: "Comment not found" }, { status: 404 });
    }

    if (error.message.includes("only delete your own")) {
      return NextResponse.json(
        { success: false, error: "You can only delete your own comments" },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to delete comment",
      },
      { status: 500 }
    );
  }
}
