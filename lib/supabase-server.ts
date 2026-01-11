import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/auth-helpers-nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";

function getEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`[supabase] Missing environment variable: ${key}`);
  }
  return value;
}

export async function getSupabaseServerClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  const supabaseUrl = getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseAnonKey = getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

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
