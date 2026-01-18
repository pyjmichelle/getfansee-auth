import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-server";
import { createClient } from "@/lib/supabase-server";
import { MOCK_TAGS, shouldUseMockData } from "@/lib/mock-data";

/**
 * GET /api/tags?category=content|creator
 * Get all tags
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");

    const supabase = await createClient();
    let query = supabase.from("tags").select("*").order("name");

    if (category === "content" || category === "creator") {
      query = query.eq("category", category);
    }

    const { data: tags, error } = await query;

    if (error) {
      console.error("[api/tags] GET error:", error);
      // If error and mock data enabled, return mock tags
      if (shouldUseMockData()) {
        const mockTags = category ? MOCK_TAGS.filter((t) => t.category === category) : MOCK_TAGS;
        return NextResponse.json({ success: true, tags: mockTags });
      }
      return NextResponse.json({ success: false, error: "Failed to fetch tags" }, { status: 500 });
    }

    // If no tags and mock data enabled, return mock tags
    if ((!tags || tags.length === 0) && shouldUseMockData()) {
      const mockTags = category ? MOCK_TAGS.filter((t) => t.category === category) : MOCK_TAGS;
      return NextResponse.json({ success: true, tags: mockTags });
    }

    return NextResponse.json({ success: true, tags });
  } catch (err: unknown) {
    console.error("[api/tags] Exception:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
