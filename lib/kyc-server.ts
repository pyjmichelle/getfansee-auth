import "server-only";

import { getSupabaseServerClient } from "./supabase-server";

export async function getUserVerification(userId: string): Promise<{
  id: string;
  status: string;
  reviewed_at: string | null;
  rejection_reason: string | null;
} | null> {
  try {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase
      .from("creator_verifications")
      .select("id, status, reviewed_at, rejection_reason")
      .eq("user_id", userId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null; // 没有验证记录
      }
      console.error("[kyc-server] getUserVerification error:", error);
      return null;
    }

    return data;
  } catch (err) {
    console.error("[kyc-server] getUserVerification exception:", err);
    return null;
  }
}
