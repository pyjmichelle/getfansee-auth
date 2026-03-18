import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/**
 * GET /api/subscriptions
 * Returns the list of active subscriptions for the current user.
 * Used by HomeFeedClient to initialise the "Following" tab filter.
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ subscriptions: [] }, { status: 200 });
    }

    const admin = getSupabaseAdminClient();
    const { data, error } = await admin
      .from("subscriptions")
      .select("creator_id, status, current_period_end")
      .eq("subscriber_id", user.id)
      .eq("status", "active");

    if (error) {
      console.error("[api/subscriptions] query error:", error);
      return NextResponse.json({ subscriptions: [] }, { status: 200 });
    }

    return NextResponse.json({ subscriptions: data ?? [] });
  } catch (err) {
    console.error("[api/subscriptions] error:", err);
    return NextResponse.json({ subscriptions: [] }, { status: 200 });
  }
}
