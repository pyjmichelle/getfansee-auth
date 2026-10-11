import {
  assertDedicatedTestProject,
  assertLocalTestTarget,
} from "../../scripts/utils/assert-test-environment";

/** Explicit opt-in; environment presence alone must never execute DB/API tests. */
export const integrationEnabled = process.env.RUN_DATABASE_INTEGRATION_TESTS === "true";
export const integrationBaseUrl = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";

if (integrationEnabled) {
  // Evaluate before importing/constructing any privileged database client.
  assertDedicatedTestProject(process.env.NEXT_PUBLIC_SUPABASE_URL || "");
  assertLocalTestTarget(integrationBaseUrl);
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is required for integration tests");
  }
}
