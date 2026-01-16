import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-server";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

/**
 * GET /api/tags?category=content|creator
 * 获取所有标签
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");

    const supabase = getSupabaseBrowserClient();
    let query = supabase.from("tags").select("*").order("name");

    if (category === "content" || category === "creator") {
      query = query.eq("category", category);
    }

    const { data: tags, error } = await query;

    if (error) {
      console.error("[api/tags] GET error:", error);
      return NextResponse.json({ success: false, error: "Failed to fetch tags" }, { status: 500 });
    }

    return NextResponse.json({ success: true, tags });
  } catch (err: unknown) {
    console.error("[api/tags] Exception:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
