import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-server";
import { createClient } from "@supabase/supabase-js";

// 使用 Service Role Key 进行管理操作
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * GET /api/admin/content-review?status=pending|approved|rejected
 * 获取待审核/已审核的内容列表
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    // 检查用户是否为管理员
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "pending";

    // 获取帖子列表
    const { data: posts, error } = await supabase
      .from("posts")
      .select(
        `
        id,
        creator_id,
        title,
        content,
        visibility,
        price_cents,
        review_status,
        reviewed_by,
        reviewed_at,
        rejection_reason,
        created_at,
        profiles:creator_id (
          display_name,
          avatar_url
        )
      `
      )
      .eq("review_status", status)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("[api/admin/content-review] GET error:", error);
      return NextResponse.json({ success: false, error: "Failed to fetch posts" }, { status: 500 });
    }

    return NextResponse.json({ success: true, posts });
  } catch (err: unknown) {
    console.error("[api/admin/content-review] Exception:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * POST /api/admin/content-review
 * 审核内容（批准或拒绝）
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    // 检查用户是否为管理员
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { postId, action, reason } = body as {
      postId: string;
      action: "approve" | "reject";
      reason?: string;
    };

    if (!postId || !action) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (action !== "approve" && action !== "reject") {
      return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
    }

    if (action === "reject" && !reason) {
      return NextResponse.json(
        { success: false, error: "Rejection reason is required" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const reviewStatus = action === "approve" ? "approved" : "rejected";

    // 更新帖子状态
    const { error: updateError } = await supabase
      .from("posts")
      .update({
        review_status: reviewStatus,
        reviewed_by: user.id,
        reviewed_at: now,
        rejection_reason: action === "reject" ? reason : null,
      })
      .eq("id", postId);

    if (updateError) {
      console.error("[api/admin/content-review] Update error:", updateError);
      return NextResponse.json({ success: false, error: "Failed to update post" }, { status: 500 });
    }

    // 记录审核日志
    await supabase.from("content_review_logs").insert({
      post_id: postId,
      reviewer_id: user.id,
      action: action === "approve" ? "approved" : "rejected",
      reason,
    });

    // TODO: 发送通知给 Creator

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("[api/admin/content-review] Exception:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
