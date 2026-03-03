import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/auth-helpers-nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

export async function createClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        const mutableCookies = cookieStore as unknown as {
          set?: (options: { name: string; value: string } & Record<string, unknown>) => void;
        };

        cookiesToSet.forEach(({ name, value, options }) => {
          if (typeof mutableCookies.set === "function") {
            mutableCookies.set({ name, value, ...options });
          }
        });
      },
    },
  });
}

export const getSupabaseServerClient = createClient;
