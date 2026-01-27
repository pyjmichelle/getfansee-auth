import type { SupabaseClient } from "@supabase/supabase-js";

export type SubscriptionUserColumn = "subscriber_id" | "fan_id" | "user_id";

const subscriptionUserColumnCandidates: SubscriptionUserColumn[] = [
  "subscriber_id",
  "fan_id",
  "user_id",
];

let cachedSubscriptionUserColumn: SubscriptionUserColumn | null = null;

export async function resolveSubscriptionUserColumn(
  supabase: SupabaseClient
): Promise<SubscriptionUserColumn> {
  if (cachedSubscriptionUserColumn) {
    return cachedSubscriptionUserColumn;
  }

  for (const column of subscriptionUserColumnCandidates) {
    const { error } = await supabase.from("subscriptions").select(column).limit(1);
    if (!error) {
      cachedSubscriptionUserColumn = column;
      return column;
    }
  }

  cachedSubscriptionUserColumn = "subscriber_id";
  return cachedSubscriptionUserColumn;
}

export function getSubscriptionUserId(
  row: Partial<Record<SubscriptionUserColumn, string | null | undefined>>,
  column: SubscriptionUserColumn
): string | null {
  return row[column] ?? null;
}
