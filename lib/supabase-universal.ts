import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 通用 Supabase Client（同时支持 Server & Client 环境）
 * 在服务器端返回 createServerComponentClient，在客户端返回 createClientComponentClient
 */

let browserClient: SupabaseClient | null = null;

export async function getSupabaseUniversalClient(): Promise<SupabaseClient> {
  if (typeof window === "undefined") {
    const { getSupabaseServerClient } = await import("./supabase-server");
    return getSupabaseServerClient();
  }

  if (!browserClient) {
    const { getSupabaseBrowserClient } = await import("./supabase-browser");
    browserClient = getSupabaseBrowserClient();
  }

  return browserClient;
}
