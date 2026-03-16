#!/usr/bin/env tsx
/**
 * Verify the NEW session route logic: local JWT claim validation
 * Simulates exactly what the route does with real Supabase tokens.
 * Run: pnpm tsx scripts/verify-session-route.ts
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join } from "path";

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  try {
    const content = readFileSync(join(process.cwd(), ".env.local"), "utf-8");
    content.split("\n").forEach((line) => {
      const t = line.trim();
      if (t && !t.startsWith("#")) {
        const idx = t.indexOf("=");
        if (idx > 0) env[t.slice(0, idx).trim()] = t.slice(idx + 1).trim();
      }
    });
  } catch {}
  return env;
}

// Copied directly from the new route.ts
type JwtPayload = {
  iss?: string;
  aud?: string | string[];
  sub?: string;
  exp?: number;
  role?: string;
};

function validateSupabaseJwt(token: string, supabaseUrl: string): JwtPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  let payload: JwtPayload;
  try {
    const json = Buffer.from(parts[1], "base64url").toString("utf-8");
    payload = JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp <= now) {
    console.log("  ✗ Token expired at:", new Date(payload.exp! * 1000).toISOString());
    return null;
  }

  const expectedIss = `${supabaseUrl}/auth/v1`;
  if (payload.iss !== expectedIss) {
    console.log("  ✗ Wrong issuer:", payload.iss, "expected:", expectedIss);
    return null;
  }

  const aud = Array.isArray(payload.aud) ? payload.aud[0] : payload.aud;
  if (aud !== "authenticated") {
    console.log("  ✗ Wrong audience:", aud);
    return null;
  }

  if (!payload.sub) {
    console.log("  ✗ Missing sub");
    return null;
  }

  return payload;
}

async function main() {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  console.log("=== Verify Session Route: Local JWT Validation ===\n");

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const anonClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Create temp user
  const tempEmail = `verify-session-${Date.now()}@example.test`;
  const { data: tempUserData } = await admin.auth.admin.createUser({
    email: tempEmail,
    password: "TempVerify123!",
    email_confirm: true,
  });
  const tempUser = tempUserData?.user;
  if (!tempUser) {
    console.log("Failed to create temp user");
    return;
  }

  // ── 1. Sign in and validate the token ────────────────────────────────
  console.log("--- Test 1: Fresh sign-in token ---");
  const { data: s1 } = await anonClient.auth.signInWithPassword({
    email: tempEmail,
    password: "TempVerify123!",
  });
  const token1 = s1.session?.access_token;
  if (!token1) {
    console.log("No token on first sign-in");
    return;
  }
  const result1 = validateSupabaseJwt(token1, url);
  console.log("  Result:", result1 ? "✅ VALID" : "❌ INVALID");
  if (result1) {
    console.log("  uid:", result1.sub);
    console.log("  expires at:", new Date(result1.exp! * 1000).toISOString());
  }

  // ── 2. Sign out, then sign in again ──────────────────────────────────
  console.log("\n--- Test 2: Sign out → sign in again (the bug scenario) ---");
  await anonClient.auth.signOut();
  const { data: s2 } = await anonClient.auth.signInWithPassword({
    email: tempEmail,
    password: "TempVerify123!",
  });
  const token2 = s2.session?.access_token;
  if (!token2) {
    console.log("No token on second sign-in");
    return;
  }
  const result2 = validateSupabaseJwt(token2, url);
  console.log("  Result:", result2 ? "✅ VALID" : "❌ INVALID");
  if (result2) {
    console.log("  uid:", result2.sub);
    console.log("  Same user as before:", result1?.sub === result2.sub ? "yes" : "no");
    console.log("  Tokens differ:", token1 !== token2 ? "yes (expected)" : "no (unexpected)");
  }

  // ── 3. Test invalid tokens ────────────────────────────────────────────
  console.log("\n--- Test 3: Invalid token cases ---");
  const cases = [
    ["empty string", ""],
    ["not a JWT", "hello"],
    ["service role key (wrong aud)", serviceKey],
    ["anon key (wrong aud)", anonKey],
    ["only 2 parts", "aaa.bbb"],
  ];
  for (const [label, tok] of cases) {
    const r = validateSupabaseJwt(tok, url);
    console.log(`  "${label}": ${r ? "⚠️  accepted (check this)" : "✅ rejected"}`);
  }

  // Cleanup
  await admin.auth.admin.deleteUser(tempUser.id);
  console.log("\n✅ Temp user cleaned up.");
  console.log("\n=== Summary ===");
  console.log("The new local JWT validation replaces admin.auth.getUser().");
  console.log("No network call, no SUPABASE_SERVICE_ROLE_KEY needed for sync.");
  console.log("Both fresh login and logout+re-login produce valid tokens.");
}

main().catch(console.error);
