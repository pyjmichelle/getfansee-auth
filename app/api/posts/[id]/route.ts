import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient();
    const postId = params.id;

    // 获取当前用户
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // 获取帖子详情（包含创作者信息）
    const { data: post, error: postError } = await supabase
      .from("posts")
      .select(
        `
        *,
        creator:profiles!posts_creator_id_fkey(
          id,
          display_name,
          avatar_url
        )
      `
      )
      .eq("id", postId)
      .single();

    if (postError || !post) {
      console.error("[GET /api/posts/[id]] Post fetch error:", postError);
      return NextResponse.json({ success: false, error: "Post not found" }, { status: 404 });
    }

    // 检查查看权限
    let canView = false;

    // 1. 创作者自己可以查看
    if (post.creator_id === user.id) {
      canView = true;
    }
    // 2. 免费内容所有人可以查看
    else if (post.visibility === "free") {
      canView = true;
    }
    // 3. 订阅内容 - 检查是否已订阅
    else if (post.visibility === "subscribers") {
      const { data: subscription } = await supabase
        .from("subscriptions")
        .select("id")
        .eq("fan_id", user.id)
        .eq("creator_id", post.creator_id)
        .eq("status", "active")
        .single();

      canView = !!subscription;
    }
    // 4. PPV 内容 - 检查是否已购买
    else if (post.visibility === "ppv") {
      const { data: purchase } = await supabase
        .from("purchases")
        .select("id")
        .eq("fan_id", user.id)
        .eq("post_id", postId)
        .single();

      canView = !!purchase;
    }

    return NextResponse.json({
      success: true,
      post: post,
      canView: canView,
    });
  } catch (error: any) {
    console.error("[GET /api/posts/[id]] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
