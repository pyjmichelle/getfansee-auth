#!/usr/bin/env tsx
/**
 * Create User Test Accounts
 * Creates the specific test accounts provided by the user
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// Load .env.local manually
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach((line) => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const [, key, value] = match;
      process.env[key.trim()] = value.trim();
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing environment variables:");
  console.error("   NEXT_PUBLIC_SUPABASE_URL");
  console.error("   SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const TEST_ACCOUNTS = [
  {
    email: "test-fan@example.com",
    password: "TestPassword123!",
    role: "fan" as const,
    userId: "dec562f2-a534-42a0-91f7-a5b8dbcf9305",
    displayName: "Test Fan",
  },
  {
    email: "test-creator@example.com",
    password: "TestPassword123!",
    role: "creator" as const,
    userId: "77deaaa3-0c60-417d-ac8d-152ec291f674",
    displayName: "Test Creator",
  },
];

async function createAccount(account: (typeof TEST_ACCOUNTS)[0]) {
  console.log(`\n📝 Creating ${account.role}: ${account.email}`);
  console.log(`   User ID: ${account.userId}`);

  try {
    // Check if user already exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find((u) => u.email === account.email);

    if (existingUser) {
      console.log(`   ⚠️  User already exists: ${existingUser.id}`);

      // Update profile
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          role: account.role,
          display_name: account.displayName,
        })
        .eq("id", existingUser.id);

      if (profileError) {
        console.error(`   ❌ Failed to update profile: ${profileError.message}`);
      } else {
        console.log(`   ✓ Profile updated`);
      }

      return;
    }

    // Create auth user with specific ID
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: account.email,
      password: account.password,
      email_confirm: true,
      user_metadata: {
        role: account.role,
      },
    });

    if (authError) {
      console.error(`   ❌ Auth creation failed: ${authError.message}`);
      return;
    }

    if (!authData.user) {
      console.error(`   ❌ No user returned from auth creation`);
      return;
    }

    console.log(`   ✓ Auth user created: ${authData.user.id}`);

    // Create/update profile
    const { error: profileError } = await supabase.from("profiles").upsert({
      id: authData.user.id,
      role: account.role,
      display_name: account.displayName,
      email: account.email,
    });

    if (profileError) {
      console.error(`   ❌ Profile creation failed: ${profileError.message}`);
      return;
    }

    console.log(`   ✓ Profile created`);
    console.log(`   ✓ Account ready: ${account.email}`);
  } catch (error: any) {
    console.error(`   ❌ Unexpected error: ${error.message}`);
  }
}

async function main() {
  console.log("🔐 Creating User Test Accounts");
  console.log("=".repeat(60));

  for (const account of TEST_ACCOUNTS) {
    await createAccount(account);
  }

  console.log("\n" + "=".repeat(60));
  console.log("✅ Test accounts ready");
  console.log("=".repeat(60));
  console.log("\nYou can now login with:");
  console.log("  Fan: test-fan@example.com / TestPassword123!");
  console.log("  Creator: test-creator@example.com / TestPassword123!");
}

main();
