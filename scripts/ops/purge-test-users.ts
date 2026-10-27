#!/usr/bin/env tsx

import { createClient, type User } from "@supabase/supabase-js";

const apply = process.argv.includes("--apply");
const allowProduction = process.argv.includes("--allow-production");
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const expectedRef = process.env.TARGET_SUPABASE_PROJECT_REF;

if (!supabaseUrl || !serviceRoleKey || !expectedRef) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and TARGET_SUPABASE_PROJECT_REF are required."
  );
}

const actualRef = new URL(supabaseUrl).hostname.split(".")[0];
if (actualRef !== expectedRef) {
  throw new Error("Target URL does not match TARGET_SUPABASE_PROJECT_REF.");
}

const e2eRef = process.env.E2E_SUPABASE_PROJECT_REF;
const isDedicatedTestProject = Boolean(e2eRef && e2eRef === actualRef);
if (apply && !isDedicatedTestProject && !allowProduction) {
  throw new Error("Use --allow-production for a non-E2E project after reviewing the dry run.");
}
if (apply && process.env.CONFIRM_TEST_DATA_PURGE !== actualRef) {
  throw new Error("Set CONFIRM_TEST_DATA_PURGE to the exact target project ref before --apply.");
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const exactEmails = new Set([
  "test-fan@example.com",
  "test-creator@example.com",
  "fan@test.com",
  "creator@test.com",
]);

function isKnownTestUser(user: User): boolean {
  const email = user.email?.toLowerCase() ?? "";
  if (exactEmails.has(email)) return true;
  return /^(e2e|int-test|poor-fan|test)-[a-z0-9+_.-]+@(example\.com|test\.example\.com)$/.test(
    email
  );
}

const financialReferences = [
  ["transactions", "user_id"],
  ["payment_orders", "user_id"],
  ["consumption_orders", "fan_id"],
  ["consumption_orders", "creator_id"],
  ["creator_ledger", "creator_id"],
  ["withdrawal_requests", "creator_id"],
  ["tips", "fan_id"],
  ["tips", "creator_id"],
  ["purchases", "fan_id"],
] as const;

async function listUsers(): Promise<User[]> {
  const users: User[] = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 200) return users;
  }
}

async function findFinancialReferences(userId: string): Promise<string[]> {
  const found: string[] = [];
  for (const [table, column] of financialReferences) {
    const { count, error } = await admin
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq(column, userId);
    if (error) {
      found.push(`${table}.${column}:check-failed`);
    } else if ((count ?? 0) > 0) {
      found.push(`${table}.${column}:${count}`);
    }
  }
  return found;
}

async function main() {
  const candidates = (await listUsers()).filter(isKnownTestUser);
  console.log(`Target project: ${actualRef}`);
  console.log(`Mode: ${apply ? "APPLY" : "DRY RUN"}`);
  console.log(`Strict test-account candidates: ${candidates.length}`);

  let deletable = 0;
  let blocked = 0;
  for (const user of candidates) {
    const references = await findFinancialReferences(user.id);
    const label = user.email ?? user.id;
    if (references.length > 0) {
      blocked += 1;
      console.log(`BLOCKED ${label}: ${references.join(", ")}`);
      continue;
    }

    deletable += 1;
    if (!apply) {
      console.log(`WOULD DELETE ${label}`);
      continue;
    }

    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw new Error(`Failed to delete ${label}: ${error.message}`);
    console.log(`DELETED ${label}`);
  }

  console.log(`Summary: deletable=${deletable}, blocked=${blocked}`);
  if (!apply) {
    console.log(
      "No changes made. Review the list, then set CONFIRM_TEST_DATA_PURGE and add --apply."
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
