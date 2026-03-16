#!/usr/bin/env tsx
/**
 * Apply migration 033: Drop posts_select_public USING(true) policy.
 *
 * CRITICAL SECURITY FIX: This policy allowed ALL users (including anon)
 * to read all posts, bypassing the paywall.
 *
 * Usage: pnpm tsx scripts/apply-migration-033.ts
 *        pnpm tsx scripts/apply-migration-033.ts --verify
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
const ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });

async function verify() {
  console.log("\n=== Verification ===");

  // Test 1: anon should NOT see subscribers/ppv posts
  const { data: anonPosts, error: anonErr } = await anon
    .from("posts")
    .select("id,visibility")
    .in("visibility", ["subscribers", "ppv"])
    .limit(5);

  if (anonErr) {
    console.log("Anon query error:", anonErr.message);
  } else if (anonPosts && anonPosts.length > 0) {
    console.log("❌ STILL LEAKING: Anon can see", anonPosts.length, "subscriber/ppv posts!");
    anonPosts.forEach((p) => console.log("   -", p.visibility, p.id.slice(0, 12) + "..."));
  } else {
    console.log("✅ Anon CANNOT see subscriber/ppv posts (leak fixed!)");
  }

  // Test 2: anon should still see free posts
  const { data: freePosts } = await anon
    .from("posts")
    .select("id,visibility")
    .eq("visibility", "free")
    .limit(3);
  console.log("✅ Anon can still see free posts:", freePosts?.length ?? 0);
}

async function main() {
  console.log("=== Migration 033: Drop posts_select_public ===\n");
  console.log("This fixes a CRITICAL data leak: posts_select_public USING(true)");
  console.log("allowed all users (including anon) to read ALL posts.\n");

  if (process.argv.includes("--verify")) {
    await verify();
    return;
  }

  console.log("📋 Manual application required:");
  console.log("1. Open https://supabase.com/dashboard/project/ordomkygjpujxyivwviq/sql/new");
  console.log("2. Paste and run the following SQL:\n");
  console.log("─".repeat(60));
  const fixSQL = readFileSync(
    join(process.cwd(), "migrations/033_drop_posts_select_public.sql"),
    "utf-8"
  );
  console.log(fixSQL);
  console.log("─".repeat(60));
  console.log("\n3. Verify: pnpm tsx scripts/apply-migration-033.ts --verify");

  // Pre-check: show current state
  console.log("\n=== Current state (pre-fix check) ===");
  await verify();
}

main().catch(console.error);
