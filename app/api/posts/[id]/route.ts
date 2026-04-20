import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getCurrentUser } from "@/lib/auth-server";
import { resolveSubscriptionUserColumn } from "@/lib/subscriptions";
import { MOCK_POSTS, MOCK_CREATORS } from "@/lib/mock-data";

function getMockPostById(postId: string) {
  const mockPost = MOCK_POSTS.find((p) => p.id === postId);
  if (!mockPost) return null;
  const mockCreator = MOCK_CREATORS.find((c) => c.id === mockPost.creator_id);
  return {
    ...mockPost,
    creator: mockCreator
      ? {
          id: mockCreator.id,
          display_name: mockCreator.display_name,
          avatar_url: mockCreator.avatar_url,
        }
      : null,
  };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const postId = resolvedParams.id;

    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    let post: Record<string, unknown> | null = null;
    let usedMockFallback = false;

    try {
      const adminSupabase = getSupabaseAdminClient();
      const { data, error: postError } = await adminSupabase
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

      if (!postError && data) {
        post = data;
      }
    } catch (adminError) {
      console.warn(
        "[GET /api/posts/[id]] Admin client unavailable, trying mock fallback:",
        adminError instanceof Error ? adminError.message : adminError
      );
    }

    if (!post && postId.startsWith("mock-")) {
      const mockData = getMockPostById(postId);
      if (mockData) {
        post = mockData as unknown as Record<string, unknown>;
        usedMockFallback = true;
      }
    }

    if (!post) {
      return NextResponse.json({ success: false, error: "Post not found" }, { status: 404 });
    }

    if (usedMockFallback) {
      const canView = post.visibility === "free";
      const safePost = canView ? post : { ...post, content: null, media_url: null };
      return NextResponse.json({ success: true, post: safePost, canView, isMock: true });
    }

    const supabase = await createClient();
    let canView = false;

    if (post.creator_id === user.id) {
      canView = true;
    } else if (post.visibility === "free") {
      canView = true;
    } else if (post.visibility === "subscribers") {
      const subscriptionUserColumn = await resolveSubscriptionUserColumn(supabase);
      const { data: subscription } = await supabase
        .from("subscriptions")
        .select("id")
        .eq(subscriptionUserColumn, user.id)
        .eq("creator_id", post.creator_id as string)
        .eq("status", "active")
        .single();

      canView = !!subscription;
    } else if (post.visibility === "ppv") {
      const { data: purchase } = await supabase
        .from("purchases")
        .select("id")
        .eq("fan_id", user.id)
        .eq("post_id", postId)
        .single();

      canView = !!purchase;
    }

    const safePost = canView
      ? post
      : {
          ...post,
          content: null,
          media_url: null,
        };

    return NextResponse.json({
      success: true,
      post: safePost,
      canView: canView,
    });
  } catch (error: unknown) {
    console.error("[GET /api/posts/[id]] Error:", error);
    const msg = error instanceof Error ? error.message : "";
    const isSensitive =
      msg.includes("SERVICE_ROLE_KEY") || msg.includes("service role") || msg.includes(".env");
    return NextResponse.json(
      {
        success: false,
        error: isSensitive ? "Service temporarily unavailable" : msg || "Internal server error",
      },
      { status: 500 }
    );
  }
}
