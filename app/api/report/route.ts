import { NextRequest, NextResponse } from "next/server";
import { withAuth, badRequest, serverError } from "@/lib/route-handler";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

type ReportType = "post" | "comment" | "user";

type ReportPayload = {
  type?: string;
  id?: string;
  postId?: string;
  creatorId?: string;
  reason?: string;
  details?: string;
};

const VALID_TYPES: ReadonlySet<ReportType> = new Set(["post", "comment", "user"]);

export const POST = withAuth(async (request: NextRequest, { user }) => {
  try {
    const body = (await request.json()) as ReportPayload;
    const type = body.type as ReportType | undefined;
    const reason = body.reason?.trim();
    const description = body.details?.trim() || null;

    if (!type || !VALID_TYPES.has(type)) {
      return badRequest("Invalid report type");
    }

    if (!reason) {
      return badRequest("Reason is required");
    }

    const reportedId = (body.id || body.postId || body.creatorId || "").trim();
    if (!reportedId) {
      return badRequest("Reported resource id is required");
    }

    const supabase = getSupabaseAdminClient();
    const { error } = await supabase.from("reports").insert({
      reporter_id: user.id,
      reported_type: type,
      reported_id: reportedId,
      reason,
      description,
      status: "pending",
    });

    if (error) {
      console.error("[api/report] insert error:", error);
      return serverError("Failed to submit report");
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("[api/report] POST error:", err);
    return serverError(err instanceof Error ? err.message : "Internal server error");
  }
});
