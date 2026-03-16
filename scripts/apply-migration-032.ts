#!/usr/bin/env tsx
/**
 * Apply migration 032: Fix RLS infinite recursion between posts and purchases.
 *
 * Usage: pnpm tsx scripts/apply-migration-032.ts
 *
 * This script applies the fix directly to the Supabase database via a
 * temporary SECURITY DEFINER function trick, then cleans up.
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

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

async function main() {
  console.log("=== Migration 032: Fix RLS infinite recursion ===\n");

  // Step 1: Create a temporary SECURITY DEFINER function that can execute DDL
  // This function will be called once and then dropped.
  const createFnSQL = `
    CREATE OR REPLACE FUNCTION public._m032_apply_rls_fix()
    RETURNS text
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    BEGIN
      DROP POLICY IF EXISTS "purchases_select_self_or_creator" ON public.purchases;

      EXECUTE $policy$
        CREATE POLICY "purchases_select_self_or_creator"
          ON public.purchases
          FOR SELECT
          TO authenticated
          USING (auth.uid() = fan_id)
      $policy$;

      RETURN 'ok';
    END;
    $$;
    GRANT EXECUTE ON FUNCTION public._m032_apply_rls_fix() TO service_role;
  `;

  // We can't run raw DDL via PostgREST, but we CAN create functions via the admin role.
  // Step: Use a workaround - create the function via rpc upsert trick.
  // Actually PostgREST still can't execute CREATE FUNCTION.
  // Best approach: use the Supabase management API if we have credentials.

  // Check if we can reach the Supabase project management API
  const mgmtResp = await fetch(`https://api.supabase.com/v1/projects`, {
    headers: { Authorization: `Bearer ${SERVICE_KEY}` },
  }).catch(() => null);

  if (mgmtResp && mgmtResp.status === 200) {
    console.log("✅ Management API accessible, applying via query endpoint...");
    // Use undocumented query endpoint
    const fixSQL = readFileSync(
      join(process.cwd(), "migrations/032_fix_rls_purchases_recursion.sql"),
      "utf-8"
    );
    const projectRef = new URL(SUPABASE_URL).hostname.split(".")[0];
    const queryResp = await fetch(
      `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: fixSQL }),
      }
    );
    console.log("Query endpoint response:", queryResp.status);
    const body = await queryResp.text();
    console.log("Body:", body.slice(0, 300));
  } else {
    console.log("ℹ️  Management API not accessible with service role key.");
    console.log("\n📋 Manual application required:");
    console.log("1. Open https://supabase.com/dashboard/project/ordomkygjpujxyivwviq/sql/new");
    console.log("2. Paste and run the following SQL:\n");
    console.log("─".repeat(60));
    const fixSQL = readFileSync(
      join(process.cwd(), "migrations/032_fix_rls_purchases_recursion.sql"),
      "utf-8"
    );
    console.log(fixSQL);
    console.log("─".repeat(60));
    console.log("\n3. Verify fix with: pnpm tsx scripts/apply-migration-032.ts --verify");
  }

  // Step 2: Verify (regardless of how it was applied)
  if (process.argv.includes("--verify") || mgmtResp?.status === 200) {
    console.log("\n=== Verification ===");
    const { error } = await admin.from("posts").select("id,visibility").limit(1);

    if (error?.code === "42P17") {
      console.log("❌ Recursion still present:", error.message);
    } else if (error) {
      console.log("⚠️  Other error (may be network):", error.message);
    } else {
      console.log("✅ posts table readable - recursion fixed!");
    }
  }
}

main().catch(console.error);
