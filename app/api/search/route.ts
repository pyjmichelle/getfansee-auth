import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { getSupabaseRouteHandlerClient } from "@/lib/supabase-route";
import { searchMockCreators, getMockPostsWithCreators, shouldUseMockData } from "@/lib/mock-data";

/**
 * GET /api/search?q=keyword&type=all|creators|posts
 * Search Creators and Posts
 */
export async function GET(request: NextRequest) {
  try {
    await requireUser();

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

    // 使用 route handler client（携带用户会话 + RLS），避免业务搜索绕过 RLS
    const supabase = await getSupabaseRouteHandlerClient();
    interface SearchResults {
      success: boolean;
      creators?: Array<{
        id: string;
        display_name: string;
        username?: string;
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

    const wantsCreators = searchType === "all" || searchType === "creators";
    const wantsPosts = searchType === "all" || searchType === "posts";

    // Creators and posts searches are independent — run them concurrently
    // instead of sequentially awaiting one, then the other (previously two
    // full round trips back-to-back for `type=all`, see 2026-07-26 audit).
    const [creatorsResult, postsResult] = await Promise.all([
      wantsCreators
        ? supabase
            .from("public_creator_profiles")
            .select("id, display_name, username, avatar_url, bio, role")
            .or(`display_name.ilike.%${query}%,username.ilike.%${query}%,bio.ilike.%${query}%`)
            .limit(10)
        : Promise.resolve(null),
      wantsPosts
        ? supabase
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
            .limit(20)
        : Promise.resolve(null),
    ]);

    if (wantsCreators) {
      if (creatorsResult?.error) {
        console.error("[api/search] Creators search error:", creatorsResult.error);
        results.creators = [];
      } else {
        results.creators = creatorsResult?.data || [];
      }

      // If no results and mock data enabled, use mock creators
      if (results.creators.length === 0 && shouldUseMockData()) {
        results.creators = searchMockCreators(query);
      }
    }

    if (wantsPosts) {
      if (postsResult?.error) {
        console.error("[api/search] Posts search error:", postsResult.error);
        results.posts = [];
      } else {
        results.posts = postsResult?.data || [];
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
