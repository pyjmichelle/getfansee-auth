import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-server";
import { getSupabaseServerClient } from "@/lib/supabase-server";

/**
 * GET /api/purchases
 * 当前用户的购买记录（E2E 与调试用）
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase
      .from("purchases")
      .select("id, post_id, paid_amount_cents")
      .eq("fan_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[api/purchases] error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const list = (data || []).map(
      (row: { id: string; post_id: string; paid_amount_cents: number }) => ({
        id: row.id,
        post_id: row.post_id,
        amount: row.paid_amount_cents / 100,
      })
    );

    return NextResponse.json({ data: list });
  } catch (err: unknown) {
    console.error("[api/purchases] exception:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
