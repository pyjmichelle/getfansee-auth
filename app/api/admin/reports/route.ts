import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { jsonError } from "@/lib/http-errors";

/**
 * GET /api/admin/reports
 * 获取待处理的举报列表（仅限 admin）
 */
export async function GET(_request: NextRequest) {
  try {
    await requireAdmin();

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("reports")
      .select(
        `
        id,
        reporter_id,
        reported_type,
        reported_id,
        reason,
        description,
        status,
        created_at,
        profiles!reports_reporter_id_fkey (
          display_name,
          avatar_url
        )
      `
      )
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[api/admin/reports] GET error:", error);
      return NextResponse.json({ error: "Failed to fetch reports" }, { status: 500 });
    }

    type ReportRow = {
      id: string;
      reporter_id: string;
      reported_type: "post" | "user" | "comment";
      reported_id: string;
      reason: string;
      description: string | null;
      status: string;
      created_at: string;
      profiles?: { display_name?: string; avatar_url?: string } | null;
    };

    const reports = ((data as ReportRow[]) || []).map((r) => ({
      id: r.id,
      reporter_id: r.reporter_id,
      reported_type: r.reported_type,
      reported_id: r.reported_id,
      reason: r.reason,
      description: r.description,
      status: r.status,
      created_at: r.created_at,
      reporter: r.profiles
        ? { display_name: r.profiles.display_name, avatar_url: r.profiles.avatar_url }
        : undefined,
    }));

    return NextResponse.json({ reports });
  } catch (error) {
    return jsonError(error);
  }
}

/**
 * PATCH /api/admin/reports
 * 处理举报：delete | ban | no_violation（仅限 admin）
 *
 * Body: { reportId: string, action: "delete" | "ban" | "no_violation", notes?: string }
 */
export async function PATCH(request: NextRequest) {
  try {
    const { user } = await requireAdmin();

    const body = await request.json();
    const { reportId, action, notes } = body as {
      reportId: string;
      action: "delete" | "ban" | "no_violation";
      notes?: string;
    };

    if (!reportId || !["delete", "ban", "no_violation"].includes(action)) {
      return NextResponse.json(
        { error: "reportId and valid action are required" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdminClient();

    // 获取举报详情
    const { data: report, error: reportError } = await supabase
      .from("reports")
      .select("*")
      .eq("id", reportId)
      .single();

    if (reportError || !report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // 执行相应操作
    if (action === "delete" && report.reported_type === "post") {
      await supabase
        .from("posts")
        .update({ deleted_at: new Date().toISOString(), removed_by_admin: true })
        .eq("id", report.reported_id);
    } else if (action === "ban" && report.reported_type === "user") {
      await supabase.from("profiles").update({ is_banned: true }).eq("id", report.reported_id);
    }

    // 更新举报状态
    const { error } = await supabase
      .from("reports")
      .update({
        status: "resolved",
        resolved_by: user.id,
        resolved_at: new Date().toISOString(),
        resolution_action: action,
        resolution_notes: notes || null,
      })
      .eq("id", reportId);

    if (error) {
      console.error("[api/admin/reports] PATCH update error:", error);
      return NextResponse.json({ error: "Failed to resolve report" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return jsonError(error);
  }
}
