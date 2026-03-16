#!/usr/bin/env tsx
/**
 * Setup Supabase Storage Buckets (migration 029)
 *
 * Creates the required storage buckets: media, avatars, verification
 *
 * Usage: pnpm tsx scripts/setup-storage-buckets.ts
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

const BUCKETS = [
  {
    id: "media",
    name: "media",
    public: false,
    fileSizeLimit: 52428800, // 50MB
    allowedMimeTypes: [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "image/gif",
      "video/mp4",
      "video/webm",
      "video/quicktime",
    ],
  },
  {
    id: "avatars",
    name: "avatars",
    public: true,
    fileSizeLimit: 5242880, // 5MB
    allowedMimeTypes: ["image/jpeg", "image/jpg", "image/png", "image/webp"],
  },
  {
    id: "verification",
    name: "verification",
    public: false,
    fileSizeLimit: 10485760, // 10MB
    allowedMimeTypes: ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"],
  },
];

async function main() {
  console.log("=== Setup Storage Buckets ===\n");

  // Try direct bucket creation via Supabase Storage API
  for (const bucket of BUCKETS) {
    process.stdout.write(`Creating bucket "${bucket.id}"... `);

    const { data: existing } = await admin.storage.getBucket(bucket.id);
    if (existing) {
      console.log("✅ already exists");
      continue;
    }

    const { error } = await admin.storage.createBucket(bucket.id, {
      public: bucket.public,
      fileSizeLimit: bucket.fileSizeLimit,
      allowedMimeTypes: bucket.allowedMimeTypes,
    });

    if (error) {
      console.log(`❌ failed: ${error.message}`);
    } else {
      console.log("✅ created");
    }
  }

  // Apply RLS policies via management API or show manual instructions
  const projectRef = new URL(SUPABASE_URL).hostname.split(".")[0];
  const mgmtResp = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: "SELECT 1" }),
    }
  ).catch(() => null);

  if (mgmtResp && mgmtResp.status === 200) {
    console.log("\n📋 Applying RLS policies via Management API...");
    const sql = readFileSync(
      join(process.cwd(), "migrations/029_create_storage_buckets.sql"),
      "utf-8"
    );
    // Extract only the RLS policy statements (skip INSERT INTO storage.buckets)
    const rlsSQL = sql
      .split("\n")
      .filter((line) => !line.trim().startsWith("INSERT INTO storage.buckets"))
      .join("\n");

    const policyResp = await fetch(
      `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: rlsSQL }),
      }
    );
    console.log(
      policyResp.ok ? "✅ RLS policies applied" : `⚠️  RLS response: ${policyResp.status}`
    );
  } else {
    console.log(
      "\n⚠️  Could not apply RLS policies automatically. Run the following SQL manually:"
    );
    console.log(`   https://supabase.com/dashboard/project/${projectRef}/sql/new`);
    console.log("\n   Paste contents of: migrations/029_create_storage_buckets.sql\n");
  }

  // Verify
  console.log("\n=== Verification ===");
  for (const bucket of BUCKETS) {
    const { data } = await admin.storage.getBucket(bucket.id);
    console.log(`  ${data ? "✅" : "❌"} ${bucket.id} (public: ${bucket.public})`);
  }
}

main().catch(console.error);
