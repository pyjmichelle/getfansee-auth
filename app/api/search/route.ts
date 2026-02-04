import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { searchMockCreators, getMockPostsWithCreators, shouldUseMockData } from "@/lib/mock-data";

/**
 * GET /api/search?q=keyword&type=all|creators|posts
 * Search Creators and Posts
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";
    const searchType = (searchParams.get("type") || "all") as "all" | "creators" | "posts";

    if (!query || query.trim().length < 2) {
      return NextResponse.json({
        success: true,
        creators: [],
        posts: [],
      });
    }

    const supabase = getSupabaseAdminClient();
    interface SearchResults {
      success: boolean;
      creators?: Array<{
        id: string;
        display_name: string;
        avatar_url?: string;
        bio?: string;
        role: string;
      }>;
      posts?: Array<{
        id: string;
        creator_id: string;
        title?: string;
        content: string;
        visibility: string;
        price_cents: number | null;
        likes_count?: number;
        created_at: string;
        profiles?:
          | {
              display_name?: string;
              avatar_url?: string;
            }
          | Array<{
              display_name?: string;
              avatar_url?: string;
            }>;
      }>;
    }
    const results: SearchResults = { success: true, creators: [], posts: [] };

    // Search Creators - 使用 public_creator_profiles view（只暴露公开信息）
    if (searchType === "all" || searchType === "creators") {
      const { data: creators, error: creatorsError } = await supabase
        .from("public_creator_profiles")
        .select("id, display_name, avatar_url, bio, role")
        .or(`display_name.ilike.%${query}%,bio.ilike.%${query}%`)
        .limit(10);

      if (creatorsError) {
        console.error("[api/search] Creators search error:", creatorsError);
        results.creators = [];
      } else {
        results.creators = creators || [];
      }

      // If no results and mock data enabled, use mock creators
      if (results.creators.length === 0 && shouldUseMockData()) {
        results.creators = searchMockCreators(query);
      }
    }

    // Search Posts
    if (searchType === "all" || searchType === "posts") {
      const { data: posts, error: postsError } = await supabase
        .from("posts")
        .select(
          `
          id,
          creator_id,
          title,
          content,
          visibility,
          price_cents,
          likes_count,
          created_at,
          profiles:creator_id (
            display_name,
            avatar_url
          )
        `
        )
        .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
        .order("created_at", { ascending: false })
        .limit(20);

      if (postsError) {
        console.error("[api/search] Posts search error:", postsError);
        results.posts = [];
      } else {
        results.posts = posts || [];
      }

      // If no results and mock data enabled, use mock posts
      if (results.posts.length === 0 && shouldUseMockData()) {
        const mockPosts = getMockPostsWithCreators();
        const lowerQuery = query.toLowerCase();
        results.posts = mockPosts.filter(
          (p) =>
            p.title.toLowerCase().includes(lowerQuery) ||
            p.content.toLowerCase().includes(lowerQuery)
        );
      }
    }

    return NextResponse.json(results);
  } catch (err: unknown) {
    console.error("[api/search] Exception:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
