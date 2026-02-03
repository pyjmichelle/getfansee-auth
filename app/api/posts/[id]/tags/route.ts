import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-server";
import { createClient } from "@/lib/supabase-server";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

/**
 * GET /api/posts/[id]/tags
 * 获取帖子的所有标签
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id: postId } = await context.params;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("post_tags")
      .select(
        `
        tags (
          id,
          name,
          slug,
          category
        )
      `
      )
      .eq("post_id", postId);

    if (error) {
      console.error("[api/posts/tags] GET error:", error);
      return NextResponse.json({ success: false, error: "Failed to fetch tags" }, { status: 500 });
    }

    interface PostTagItem {
      tags: {
        id: string;
        name: string;
        slug: string;
        category: string | null;
      } | null;
    }
    const tags =
      ((data as unknown as PostTagItem[] | null) ?? [])
        .map((item) => item.tags)
        .filter((tag): tag is NonNullable<PostTagItem["tags"]> => Boolean(tag)) || [];
    return NextResponse.json({ success: true, tags });
  } catch (err: unknown) {
    console.error("[api/posts/tags] Exception:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * POST /api/posts/[id]/tags
 * 为帖子添加标签
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id: postId } = await context.params;
    const body = await request.json();
    const { tagIds } = body as { tagIds: string[] };

    if (!tagIds || !Array.isArray(tagIds) || tagIds.length === 0) {
      return NextResponse.json({ success: false, error: "Invalid tag IDs" }, { status: 400 });
    }

    const supabase = await createClient();

    // 验证用户是否拥有该帖子
    const { data: post, error: postError } = await supabase
      .from("posts")
      .select("creator_id")
      .eq("id", postId)
      .single();

    if (postError || !post) {
      return NextResponse.json({ success: false, error: "Post not found" }, { status: 404 });
    }

    if (post.creator_id !== user.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
    }

    // 批量插入标签（忽略已存在的）
    const postTags = tagIds.map((tagId) => ({
      post_id: postId,
      tag_id: tagId,
    }));

    const { error: insertError } = await supabase.from("post_tags").upsert(postTags);

    if (insertError) {
      console.error("[api/posts/tags] POST error:", insertError);
      return NextResponse.json({ success: false, error: "Failed to add tags" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("[api/posts/tags] Exception:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/posts/[id]/tags
 * 移除帖子的标签
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id: postId } = await context.params;
    const { searchParams } = new URL(request.url);
    const tagId = searchParams.get("tagId");

    if (!tagId) {
      return NextResponse.json({ success: false, error: "Missing tag ID" }, { status: 400 });
    }

    const supabase = await createClient();

    // 验证用户是否拥有该帖子
    const { data: post, error: postError } = await supabase
      .from("posts")
      .select("creator_id")
      .eq("id", postId)
      .single();

    if (postError || !post) {
      return NextResponse.json({ success: false, error: "Post not found" }, { status: 404 });
    }

    if (post.creator_id !== user.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
    }

    // 删除标签
    const { error: deleteError } = await supabase
      .from("post_tags")
      .delete()
      .eq("post_id", postId)
      .eq("tag_id", tagId);

    if (deleteError) {
      console.error("[api/posts/tags] DELETE error:", deleteError);
      return NextResponse.json({ success: false, error: "Failed to remove tag" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("[api/posts/tags] Exception:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
