#!/usr/bin/env tsx
/**
 * Environment Variables Checker
 *
 * Verifies that all required environment variables are set before running tests.
 */

import * as fs from "fs";
import * as path from "path";

// Load .env.local if it exists
const envLocalPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envLocalPath)) {
  const envContent = fs.readFileSync(envLocalPath, "utf-8");
  envContent.split("\n").forEach((line) => {
    line = line.trim();
    if (line && !line.startsWith("#")) {
      const [key, ...valueParts] = line.split("=");
      const value = valueParts.join("=").trim();
      if (key && value && !process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

const optional = ["NEXT_PUBLIC_TEST_MODE", "PLAYWRIGHT_BASE_URL", "CI"];

console.log("🔍 Checking Environment Variables...\n");

let hasErrors = false;

console.log("Required:");
for (const key of required) {
  const value = process.env[key];
  if (!value || value === "your_" + key.toLowerCase() + "_here") {
    console.log(`  ❌ ${key} - NOT SET`);
    hasErrors = true;
  } else {
    const masked = value.substring(0, 10) + "..." + value.substring(value.length - 4);
    console.log(`  ✅ ${key} - ${masked}`);
  }
}

console.log("\nOptional:");
for (const key of optional) {
  const value = process.env[key];
  if (value) {
    console.log(`  ✅ ${key} - ${value}`);
  } else {
    console.log(`  ⚪ ${key} - not set (will use defaults)`);
  }
}

if (hasErrors) {
  console.log("\n❌ ERROR: Missing required environment variables!");
  console.log("\nTo fix:");
  console.log("  1. Copy env.ci.template to .env.local:");
  console.log("     cp env.ci.template .env.local");
  console.log("  2. Edit .env.local and fill in your Supabase credentials");
  console.log("  3. Run this script again: tsx scripts/check-env.ts\n");
  process.exit(1);
}

console.log("\n✅ All required environment variables are set!");
process.exit(0);
