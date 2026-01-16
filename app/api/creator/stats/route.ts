import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-server";
import { getCreatorStats, getCreatorChartData, getRecentPosts } from "@/lib/creator-stats";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const timeRange = (searchParams.get("timeRange") || "30d") as "7d" | "30d" | "90d";
    const includeChart = searchParams.get("includeChart") === "true";
    const includePosts = searchParams.get("includePosts") === "true";

    console.log("[api/creator/stats] Fetching stats for creator:", {
      creatorId: user.id,
      timeRange,
    });

    // 获取统计数据
    const stats = await getCreatorStats(user.id, timeRange);

    const response: any = { success: true, stats };

    // 可选：包含图表数据
    if (includeChart) {
      const chartData = await getCreatorChartData(user.id, timeRange);
      response.chartData = chartData;
    }

    // 可选：包含最近的帖子
    if (includePosts) {
      const recentPosts = await getRecentPosts(user.id, 3);
      response.recentPosts = recentPosts;
    }

    return NextResponse.json(response);
  } catch (err: unknown) {
    console.error("[api/creator/stats] Exception:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
