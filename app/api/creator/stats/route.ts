import { NextRequest, NextResponse } from "next/server";
import { requireCreator } from "@/lib/authz";
import { jsonError } from "@/lib/http-errors";
import {
  getCreatorStats,
  getCreatorChartData,
  getRecentPosts,
  type CreatorStats,
  type ChartDataPoint,
} from "@/lib/creator-stats";
type RecentPost = Awaited<ReturnType<typeof getRecentPosts>>[number];

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireCreator();

    const { searchParams } = new URL(request.url);
    const timeRange = (searchParams.get("timeRange") || "30d") as "7d" | "30d" | "90d";
    const includeChart = searchParams.get("includeChart") === "true";
    const includePosts = searchParams.get("includePosts") === "true";

    // 获取统计数据
    const stats = await getCreatorStats(user.id, timeRange);

    interface StatsResponse {
      success: boolean;
      stats: CreatorStats;
      chartData?: ChartDataPoint[];
      recentPosts?: RecentPost[];
    }
    const response: StatsResponse = { success: true, stats };

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
    return jsonError(err);
  }
}
