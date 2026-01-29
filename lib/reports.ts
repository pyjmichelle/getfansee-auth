"use client";

/**
 * Reports 数据访问层
 * 举报系统
 */

import { getSupabaseBrowserClient } from "./supabase-browser";
import { getCurrentUser } from "./auth";

const supabase = getSupabaseBrowserClient();

export type ReportType = "post" | "user" | "comment";

export interface ReportData {
  reported_type: ReportType;
  reported_id: string;
  reason: string;
  description?: string;
}

/**
 * 提交举报
 * @param data 举报数据
 * @returns true 成功，false 失败
 */
export async function submitReport(data: ReportData): Promise<boolean> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      console.error("[reports] submitReport: no user");
      return false;
    }

    const { error } = await supabase.from("reports").insert({
      reporter_id: user.id,
      reported_type: data.reported_type,
      reported_id: data.reported_id,
      reason: data.reason,
      description: data.description || null,
      status: "pending",
    });

    if (error) {
      console.error("[reports] submitReport error:", error);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[reports] submitReport exception:", err);
    return false;
  }
}

/**
 * 获取待处理举报列表（管理员使用）
 * @returns 举报列表
 */
export async function listPendingReports(): Promise<
  Array<{
    id: string;
    reporter_id: string;
    reported_type: ReportType;
    reported_id: string;
    reason: string;
    description: string | null;
    status: string;
    created_at: string;
    reporter?: {
      display_name?: string;
      avatar_url?: string;
    };
  }>
> {
  try {
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
      console.error("[reports] listPendingReports error:", error);
      return [];
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
      profiles?: {
        display_name?: string;
        avatar_url?: string;
      } | null;
    };

    return ((data as ReportRow[] | null) || []).map((r) => ({
      id: r.id,
      reporter_id: r.reporter_id,
      reported_type: r.reported_type,
      reported_id: r.reported_id,
      reason: r.reason,
      description: r.description,
      status: r.status,
      created_at: r.created_at,
      reporter: r.profiles
        ? {
            display_name: r.profiles.display_name,
            avatar_url: r.profiles.avatar_url,
          }
        : undefined,
    }));
  } catch (err) {
    console.error("[reports] listPendingReports exception:", err);
    return [];
  }
}

/**
 * 处理举报（管理员使用）
 * @param reportId 举报 ID
 * @param action 处理动作：'delete' | 'ban' | 'no_violation'
 * @param notes 处理备注（可选）
 * @returns true 成功，false 失败
 */
export async function resolveReport(
  reportId: string,
  action: "delete" | "ban" | "no_violation",
  notes?: string
): Promise<boolean> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      console.error("[reports] resolveReport: no user");
      return false;
    }

    // 获取举报信息
    const { data: report, error: reportError } = await supabase
      .from("reports")
      .select("*")
      .eq("id", reportId)
      .single();

    if (reportError || !report) {
      console.error("[reports] resolveReport: report not found", reportError);
      return false;
    }

    // 根据 action 执行相应操作
    if (action === "delete" && report.reported_type === "post") {
      // 删除内容
      await supabase
        .from("posts")
        .update({
          deleted_at: new Date().toISOString(),
          removed_by_admin: true,
        })
        .eq("id", report.reported_id);
    } else if (action === "ban" && report.reported_type === "user") {
      // 封禁用户
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
      console.error("[reports] resolveReport error:", error);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[reports] resolveReport exception:", err);
    return false;
  }
}
