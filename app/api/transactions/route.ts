import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-server";
import { getSupabaseServerClient } from "@/lib/supabase-server";

type TransactionRow = {
  id: string;
  user_id: string;
  type: string;
  amount_cents: number;
  status: string;
  related_id?: string | null;
  metadata?: Record<string, unknown> | null;
};

/**
 * GET /api/transactions
 * 当前用户相关交易记录（E2E 与调试用）
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase
      .from("transactions")
      .select("id, user_id, type, amount_cents, status, metadata")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[api/transactions] error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const list = ((data as TransactionRow[] | null) || []).map((row) => ({
      id: row.id,
      user_id: row.user_id,
      type: row.type,
      amount: row.amount_cents / 100,
      status: row.status,
      related_id: (row as TransactionRow & { related_id?: string }).related_id ?? undefined,
      metadata: row.metadata ?? undefined,
    }));

    return NextResponse.json({ data: list });
  } catch (err: unknown) {
    console.error("[api/transactions] exception:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
