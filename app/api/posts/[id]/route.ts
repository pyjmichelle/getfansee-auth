import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getCurrentUser } from "@/lib/auth-server";
import { getVisitorCountry, isCountryBlocked } from "@/lib/geo-utils";
import { getPostAccessMap, sanitizePostForViewer } from "@/lib/posts";
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
          id, creator_id, title, content, media_url, visibility, price_cents,
          preview_enabled, watermark_enabled, likes_count, created_at, review_status,
          creator:profiles!posts_creator_id_fkey(
            id,
            display_name,
            avatar_url
          )
        `
        )
        .eq("id", postId)
        .is("deleted_at", null)
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
      const safePost = sanitizePostForViewer(post, canView);
      return NextResponse.json({ success: true, post: safePost, canView, isMock: true });
    }

    // Admin reads must enforce moderation separately from paid entitlement.
    if (post.creator_id !== user.id && post.review_status !== "approved") {
      return NextResponse.json({ success: false, error: "Post not found" }, { status: 404 });
    }
    if (post.creator_id !== user.id) {
      const country = await getVisitorCountry();
      if (country) {
        const { data: creator, error: creatorError } = await getSupabaseAdminClient()
          .from("public_creator_profiles")
          .select("blocked_countries")
          .eq("id", post.creator_id as string)
          .single();
        if (creatorError || !creator) {
          return NextResponse.json(
            { success: false, error: "Service temporarily unavailable" },
            { status: 503 }
          );
        }
        if (isCountryBlocked(creator.blocked_countries, country)) {
          return NextResponse.json({ success: false, error: "Post not found" }, { status: 404 });
        }
      }
    }
    const access = await getPostAccessMap(
      [
        {
          id: postId,
          creator_id: post.creator_id as string,
          visibility: post.visibility as string,
        },
      ],
      user.id
    );
    const canView = access.get(postId) === true;
    const safePost = sanitizePostForViewer(post, canView);

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
