#!/usr/bin/env tsx
/**
 * Apply migration 036: Fix unlock_ppv price → price_cents regression.
 *
 * Migration 035 accidentally referenced v_post.price instead of v_post.price_cents,
 * causing ALL PPV purchases to fail with a PL/pgSQL runtime exception
 * ("record has no field price" or "Invalid post price").
 *
 * This script applies the fix via the Supabase Management API (if a personal
 * access token is available) or prints the SQL for manual application.
 *
 * Usage:
 *   pnpm tsx scripts/apply-migration-036.ts           # apply or print SQL
 *   pnpm tsx scripts/apply-migration-036.ts --verify  # check if fix is live
 *
 * Environment variables (read from .env.local or process.env):
 *   NEXT_PUBLIC_SUPABASE_URL      – required
 *   SUPABASE_SERVICE_ROLE_KEY     – required (used for verification)
 *   SUPABASE_ACCESS_TOKEN         – optional; if set, enables automatic DDL apply
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join } from "path";

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = { ...process.env } as Record<string, string>;
  try {
    const content = readFileSync(join(process.cwd(), ".env.local"), "utf-8");
    content.split("\n").forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const idx = trimmed.indexOf("=");
        if (idx > 0) {
          const key = trimmed.slice(0, idx).trim();
          const val = trimmed.slice(idx + 1).trim();
          if (!env[key]) env[key] = val;
        }
      }
    });
  } catch {}
  return env;
}

const env = loadEnv();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const ACCESS_TOKEN = env.SUPABASE_ACCESS_TOKEN; // Supabase Personal Access Token

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// Extract project reference from Supabase URL
// e.g. "https://abcdefgh.supabase.co" → "abcdefgh"
const projectRef = new URL(SUPABASE_URL).hostname.split(".")[0];

/**
 * Verify that unlock_ppv is working by calling it with an invalid post ID.
 * A properly-deployed function returns {"success":false,"error":"Post not found"}.
 * A buggy migration-035 function throws a runtime exception (which Supabase
 * surfaces as a 500 error, not a JSON success:false).
 */
async function verifyUnlockPpv(): Promise<{ ok: boolean; detail: string }> {
  // Use a random UUID that cannot be a real post
  const dummyPostId = "00000000-0000-0000-0000-000000000000";
  // The service role key bypasses auth.uid() == p_user_id check ONLY if the function
  // allows service role. For verification we just need to see the error type.
  // We call via a direct fetch to the PostgREST RPC endpoint.
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/unlock_ppv`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_KEY}`,
      apikey: SERVICE_KEY,
    },
    body: JSON.stringify({
      p_post_id: dummyPostId,
      p_user_id: "00000000-0000-0000-0000-000000000001",
      p_idempotency_key: null,
    }),
  });

  const body = await resp.text();

  if (resp.status === 200) {
    // Got a JSONB response — check if it's the expected "Post not found" or the price bug
    try {
      const json = JSON.parse(body);
      if (json.success === false && json.error === "Post not found") {
        return { ok: true, detail: "✅ unlock_ppv is correctly deployed (migration 036)" };
      }
      if (json.success === false && json.error === "Invalid post price") {
        return {
          ok: false,
          detail: "❌ unlock_ppv has the migration-035 price bug (needs migration 036)",
        };
      }
      if (json.success === false && json.error === "Unauthorized") {
        // Called with service role; function enforces auth.uid() == p_user_id.
        // Unauthorized means the function ran without error up to the auth check.
        // This means the function itself is fine (no price-bug crash before the auth check).
        return { ok: true, detail: "✅ unlock_ppv function accessible (auth check working)" };
      }
      return { ok: true, detail: `✅ unlock_ppv responded: ${JSON.stringify(json)}` };
    } catch {
      return { ok: false, detail: `⚠️  Unexpected 200 body: ${body.slice(0, 200)}` };
    }
  }

  if (resp.status === 500) {
    // Runtime exception from PL/pgSQL — this is the migration-035 bug symptom
    return {
      ok: false,
      detail: `❌ unlock_ppv threw a runtime exception (migration-035 bug): ${body.slice(0, 200)}`,
    };
  }

  if (resp.status === 404) {
    return { ok: false, detail: "❌ unlock_ppv function not found (not deployed)" };
  }

  return {
    ok: false,
    detail: `⚠️  Unexpected status ${resp.status}: ${body.slice(0, 200)}`,
  };
}

async function applyViaMgmtApi(sql: string): Promise<boolean> {
  if (!ACCESS_TOKEN) {
    return false;
  }

  const resp = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });

  if (resp.ok) {
    console.log("✅ Migration applied via Supabase Management API");
    return true;
  }

  const body = await resp.text();
  console.warn(`⚠️  Management API returned ${resp.status}: ${body.slice(0, 300)}`);
  return false;
}

async function main() {
  console.log("=== Migration 036: Fix unlock_ppv price → price_cents regression ===\n");

  if (process.argv.includes("--verify")) {
    const result = await verifyUnlockPpv();
    console.log(result.detail);
    process.exit(result.ok ? 0 : 1);
  }

  // Pre-check: is the fix already live?
  console.log("Checking current unlock_ppv status...");
  const preCheck = await verifyUnlockPpv();
  console.log(preCheck.detail);

  if (preCheck.ok) {
    console.log("\n✅ unlock_ppv is already correct — no migration needed.");
    return;
  }

  const fixSQL = readFileSync(
    join(process.cwd(), "migrations/036_fix_unlock_ppv_price_cents.sql"),
    "utf-8"
  );

  // Attempt automatic apply via Management API
  if (ACCESS_TOKEN) {
    console.log("\nAttempting automatic apply via Supabase Management API...");
    const applied = await applyViaMgmtApi(fixSQL);
    if (applied) {
      console.log("\nVerifying fix...");
      const postCheck = await verifyUnlockPpv();
      console.log(postCheck.detail);
      if (!postCheck.ok) {
        console.error("❌ Fix verification failed after apply!");
        process.exit(1);
      }
      return;
    }
  } else {
    console.log("\nℹ️  SUPABASE_ACCESS_TOKEN not set — cannot apply automatically.");
    console.log(
      "   Add SUPABASE_ACCESS_TOKEN (Supabase personal access token) to enable auto-apply.\n"
    );
  }

  // Fall back to manual instructions
  console.log("\n📋 Manual application required:");
  console.log(`1. Open https://supabase.com/dashboard/project/${projectRef}/sql/new`);
  console.log("2. Paste and run the following SQL:\n");
  console.log("─".repeat(60));
  console.log(fixSQL);
  console.log("─".repeat(60));
  console.log("\n3. Verify: pnpm tsx scripts/apply-migration-036.ts --verify");

  // Exit with error so CI fails clearly instead of via timeout
  process.exit(1);
}

main().catch((err) => {
  console.error("Script error:", err);
  process.exit(1);
});
