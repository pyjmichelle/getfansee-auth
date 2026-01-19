#!/usr/bin/env tsx
/**
 * Create Test Accounts
 *
 * Creates Fan and Creator test accounts for audit testing.
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const TEST_ACCOUNTS = [
  {
    email: "fan@test.com",
    password: "TestFan123!",
    role: "fan",
    displayName: "Test Fan",
  },
  {
    email: "creator@test.com",
    password: "TestCreator123!",
    role: "creator",
    displayName: "Test Creator",
  },
];

async function createAccount(account: (typeof TEST_ACCOUNTS)[0]) {
  console.log(`\n📝 Creating ${account.role}: ${account.email}`);

  try {
    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: account.email,
      password: account.password,
      email_confirm: true,
    });

    if (authError) {
      if (authError.message.includes("already registered")) {
        console.log(`  ℹ️  User already exists: ${account.email}`);

        // Get existing user
        const { data: users } = await supabase.auth.admin.listUsers();
        const existingUser = users.users.find((u) => u.email === account.email);

        if (existingUser) {
          // Update profile role
          const { error: updateError } = await supabase
            .from("profiles")
            .update({ role: account.role, display_name: account.displayName })
            .eq("id", existingUser.id);

          if (updateError) {
            console.log(`  ⚠️  Failed to update profile: ${updateError.message}`);
          } else {
            console.log(`  ✓ Profile updated to role: ${account.role}`);
          }
        }

        return;
      }
      throw authError;
    }

    console.log(`  ✓ Auth user created: ${authData.user.id}`);

    // Update profile
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        role: account.role,
        display_name: account.displayName,
      })
      .eq("id", authData.user.id);

    if (profileError) {
      console.log(`  ⚠️  Failed to update profile: ${profileError.message}`);
    } else {
      console.log(`  ✓ Profile updated to role: ${account.role}`);
    }

    console.log(`  ✅ Account created successfully`);
  } catch (error: any) {
    console.error(`  ❌ Error: ${error.message}`);
  }
}

async function main() {
  console.log("🚀 Create Test Accounts");
  console.log("=".repeat(60));

  if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Missing environment variables:");
    console.error("   NEXT_PUBLIC_SUPABASE_URL");
    console.error("   SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  for (const account of TEST_ACCOUNTS) {
    await createAccount(account);
  }

  console.log("\n" + "=".repeat(60));
  console.log("✅ Test accounts ready");
  console.log("\nCredentials:");
  console.log("  Fan:");
  console.log(`    Email: fan@test.com`);
  console.log(`    Password: TestFan123!`);
  console.log("  Creator:");
  console.log(`    Email: creator@test.com`);
  console.log(`    Password: TestCreator123!`);
}

main();
