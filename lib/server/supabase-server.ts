import "server-only";

/**
 * Server Component / Server Action Supabase client.
 * Canonical implementation lives in `lib/supabase/server.ts` (@supabase/ssr).
 * Re-exported here to preserve existing import paths.
 */
export { createClient, getSupabaseServerClient } from "@/lib/supabase/server";
