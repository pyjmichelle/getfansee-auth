#!/usr/bin/env tsx
import { assertDedicatedTestProject } from "./utils/assert-test-environment";
function requireTestPassword(): string {
  const password = process.env.E2E_TEST_USER_PASSWORD;
  if (!password) throw new Error("E2E_TEST_USER_PASSWORD is required.");
  return password;
}
/**
 * Test Supabase Login Directly
 */
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// Load .env.local
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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

assertDedicatedTestProject(SUPABASE_URL);
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testLogin() {
  console.log("🔐 Testing Supabase Login");
  console.log("Email: test-fan@example.com");

  const { data, error } = await supabase.auth.signInWithPassword({
    email: "test-fan@example.com",
    password: requireTestPassword(),
  });

  if (error) {
    console.error("❌ Login Error:", error.message);
    console.error("   Code:", error.status);
    process.exit(1);
  }

  console.log("✅ Login Successful!");
  console.log("   User ID:", data.user?.id);
  console.log("   Email:", data.user?.email);
  console.log("   Session:", data.session ? "Present" : "Missing");
}

testLogin();
