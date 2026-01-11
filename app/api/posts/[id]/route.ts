import { NextRequest, NextResponse } from "next/server";
import { getPost, updatePost } from "@/lib/posts";
import { getCurrentUser } from "@/lib/auth-server";

type UpdatePostPayload = {
  title?: string;
  content?: string;
  mediaFiles?: Array<{
    url: string;
    type: "image" | "video";
    fileName: string;
    fileSize: number;
  }>;
};

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const postId = id;
    const post = await getPost(postId);

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // 验证是否为 post 的 creator
    if (post.creator_id !== user.id) {
      return NextResponse.json({ error: "Not authorized to view this post" }, { status: 403 });
    }

    return NextResponse.json({ post });
  } catch (err: unknown) {
    console.error("[api] get post error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const postId = id;
    const body = (await request.json()) as UpdatePostPayload;
    const { title, content, mediaFiles } = body;

    // 验证是否为 post 的 creator
    const post = await getPost(postId);
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    if (post.creator_id !== user.id) {
      return NextResponse.json({ error: "Not authorized to edit this post" }, { status: 403 });
    }

    const success = await updatePost(postId, {
      title,
      content,
      mediaFiles,
    });

    if (success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ success: false, error: "Failed to update post" }, { status: 500 });
    }
  } catch (err: unknown) {
    console.error("[api] update post error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
