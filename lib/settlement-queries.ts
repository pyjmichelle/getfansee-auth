import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export interface ConsumptionOrderRow {
  id: string;
  fan_id: string;
  creator_id: string;
  kind: string;
  gross_amount_cents: number;
  platform_fee_cents: number;
  creator_net_cents: number;
  reversed_at: string | null;
  reversal_reason: string | null;
  buyer_country: string | null;
  buyer_region: string | null;
  created_at: string;
}

export async function listRecentConsumptionOrders(limit: number): Promise<ConsumptionOrderRow[]> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("consumption_orders")
    .select(
      "id, fan_id, creator_id, kind, gross_amount_cents, platform_fee_cents, creator_net_cents, reversed_at, reversal_reason, buyer_country, buyer_region, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[settlement-queries] listRecentConsumptionOrders failed:", error);
    return [];
  }
  return (data ?? []) as ConsumptionOrderRow[];
}
