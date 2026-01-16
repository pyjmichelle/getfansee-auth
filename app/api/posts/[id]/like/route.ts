import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-server";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

/**
 * POST /api/posts/[id]/like
 * 点赞一个帖子
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id: postId } = await context.params;

    console.log("[api/posts/like] POST:", { userId: user.id, postId });

    const supabase = getSupabaseBrowserClient();

    // 检查帖子是否存在
    const { data: post, error: postError } = await supabase
      .from("posts")
      .select("id")
      .eq("id", postId)
      .single();

    if (postError || !post) {
      return NextResponse.json({ success: false, error: "Post not found" }, { status: 404 });
    }

    // 尝试插入点赞记录（如果已存在会失败）
    const { error: insertError } = await supabase
      .from("post_likes")
      .insert({
        post_id: postId,
        user_id: user.id,
      })
      .select()
      .single();

    if (insertError) {
      // 23505 是 PostgreSQL 的唯一约束冲突错误码
      if (insertError.code === "23505") {
        return NextResponse.json(
          { success: false, error: "Already liked", alreadyLiked: true },
          { status: 409 }
        );
      }

      console.error("[api/posts/like] Insert error:", insertError);
      return NextResponse.json({ success: false, error: "Failed to like post" }, { status: 500 });
    }

    // 获取更新后的点赞数
    const { data: updatedPost } = await supabase
      .from("posts")
      .select("likes_count")
      .eq("id", postId)
      .single();

    return NextResponse.json({
      success: true,
      likesCount: updatedPost?.likes_count || 0,
    });
  } catch (err: unknown) {
    console.error("[api/posts/like] Exception:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/posts/[id]/like
 * 取消点赞一个帖子
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id: postId } = await context.params;

    console.log("[api/posts/like] DELETE:", { userId: user.id, postId });

    const supabase = getSupabaseBrowserClient();

    // 删除点赞记录
    const { error: deleteError } = await supabase
      .from("post_likes")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", user.id);

    if (deleteError) {
      console.error("[api/posts/like] Delete error:", deleteError);
      return NextResponse.json({ success: false, error: "Failed to unlike post" }, { status: 500 });
    }

    // 获取更新后的点赞数
    const { data: updatedPost } = await supabase
      .from("posts")
      .select("likes_count")
      .eq("id", postId)
      .single();

    return NextResponse.json({
      success: true,
      likesCount: updatedPost?.likes_count || 0,
    });
  } catch (err: unknown) {
    console.error("[api/posts/like] Exception:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
