import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-server";
import { createClient } from "@/lib/supabase-server";
import { getPublicCreatorLabels } from "@/lib/public-profiles";
import { getMockPostsByTag, MOCK_TAGS, shouldUseMockData } from "@/lib/mock-data";

/**
 * GET /api/tags/[tag]/posts
 * Get posts with a specific tag
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ tag: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { tag } = await params;
    const decodedTag = decodeURIComponent(tag);

    const supabase = await createClient();

    // First, find the tag by name
    const { data: tagData, error: tagError } = await supabase
      .from("tags")
      .select("id, name, category")
      .ilike("name", decodedTag)
      .single();

    if (tagError || !tagData) {
      // If mock data enabled, return mock posts for this tag
      if (shouldUseMockData()) {
        const mockTag = MOCK_TAGS.find((t) => t.name.toLowerCase() === decodedTag.toLowerCase());
        const mockPosts = getMockPostsByTag(decodedTag);
        return NextResponse.json({
          success: true,
          tag: mockTag || { name: decodedTag, category: "content" },
          posts: mockPosts,
        });
      }
      return NextResponse.json({
        success: true,
        tag: { name: decodedTag, category: "content" },
        posts: [],
      });
    }

    // Get post IDs associated with this tag
    const { data: postTags, error: postTagsError } = await supabase
      .from("post_tags")
      .select("post_id")
      .eq("tag_id", tagData.id);

    if (postTagsError) {
      console.error("[api/tags/[tag]/posts] post_tags error:", postTagsError);
      return NextResponse.json({ success: false, error: "Failed to fetch posts" }, { status: 500 });
    }

    if (!postTags || postTags.length === 0) {
      // If mock data enabled, return mock posts for this tag
      if (shouldUseMockData()) {
        const mockPosts = getMockPostsByTag(decodedTag);
        return NextResponse.json({
          success: true,
          tag: tagData,
          posts: mockPosts,
        });
      }
      return NextResponse.json({
        success: true,
        tag: tagData,
        posts: [],
      });
    }

    const postIds = postTags.map((pt) => pt.post_id);

    // Posts remain subject to viewer RLS; creator labels use the safe projection.
    const { data: posts, error: postsError } = await supabase
      .from("posts")
      .select(
        "id, creator_id, title, content, media_url, visibility, price_cents, likes_count, created_at"
      )
      .in("id", postIds)
      .order("created_at", { ascending: false });

    if (postsError) {
      console.error("[api/tags/[tag]/posts] posts error:", postsError);
      return NextResponse.json({ success: false, error: "Failed to fetch posts" }, { status: 500 });
    }

    const creators = await getPublicCreatorLabels(
      supabase,
      (posts ?? []).map((post) => post.creator_id)
    );
    return NextResponse.json({
      success: true,
      tag: tagData,
      posts: (posts ?? [])
        .filter((post) => creators.has(post.creator_id))
        .map((post) => ({
          ...post,
          creator: creators.get(post.creator_id),
        })),
    });
  } catch (err: unknown) {
    console.error("[api/tags/[tag]/posts] Exception:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
