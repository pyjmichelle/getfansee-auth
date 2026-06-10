import "server-only";

/**
 * Route Handler Supabase client.
 * Canonical implementation lives in `lib/supabase/route.ts` (@supabase/ssr).
 * Re-exported here to preserve existing import paths.
 */
export { getSupabaseRouteHandlerClient } from "@/lib/supabase/route";
