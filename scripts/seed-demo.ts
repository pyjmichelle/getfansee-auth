/**
 * Seed demo data for Money & Access MVP
 *
 * Usage:
 *   pnpm tsx scripts/seed-demo.ts
 *
 * Or in Node.js:
 *   node --loader ts-node/esm scripts/seed-demo.ts
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join } from "path";

// Load environment variables
function loadEnv() {
  const env: Record<string, string> = {};

  // Try process.env first (for CI)
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  }
  if (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  }
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  }

  // Fallback to .env.local
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    try {
      const envPath = join(process.cwd(), ".env.local");
      const envContent = readFileSync(envPath, "utf-8");

      envContent.split("\n").forEach((line) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#")) {
          const [key, ...valueParts] = trimmed.split("=");
          if (key && valueParts.length > 0) {
            const keyName = key.trim();
            const value = valueParts
              .join("=")
              .trim()
              .replace(/^["']|["']$/g, "");
            if (!env[keyName]) {
              env[keyName] = value;
            }
          }
        }
      });
    } catch (err) {
      // .env.local not found, use process.env
    }
  }

  return env;
}

const env = loadEnv();
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !anonKey) {
  console.error(
    "❌ Missing environment variables: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
  );
  process.exit(1);
}

// Use service role if available, otherwise use anon (will be limited by RLS)
const supabase = serviceKey
  ? createClient(supabaseUrl, serviceKey)
  : createClient(supabaseUrl, anonKey);

async function seedDemo() {
  console.log("🌱 Starting demo data seed...\n");

  try {
    // 1. Get or create a demo creator
    let creatorId: string | null = null;
    let creatorEmail: string | null = null;

    // Try to find existing creator
    const { data: existingCreators, error: listError } = await supabase
      .from("creators")
      .select("id")
      .limit(1);

    if (listError && listError.code !== "PGRST116") {
      // PGRST116 = no rows returned
      console.error("❌ Error checking creators:", listError);
      throw listError;
    }

    if (existingCreators && existingCreators.length > 0) {
      creatorId = existingCreators[0].id;
      console.log(`✅ Found existing creator: ${creatorId}`);
    } else {
      // Try to get first user from auth.users (requires service role)
      if (serviceKey) {
        const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
        if (!usersError && users && users.users.length > 0) {
          const firstUser = users.users[0];
          creatorId = firstUser.id;
          creatorEmail = firstUser.email || null;
          console.log(`✅ Using first user as creator: ${creatorId}`);
        }
      }

      if (!creatorId) {
        console.log("⚠️  No existing creator found and cannot access auth.users");
        console.log("   Please create a creator profile via /me page first");
        console.log("   Or run this script with SUPABASE_SERVICE_ROLE_KEY");
        return;
      }

      // Ensure profile exists with role='creator'
      const { error: profileError } = await supabase.from("profiles").upsert(
        {
          id: creatorId,
          display_name: creatorEmail?.split("@")[0] || "Demo Creator",
          role: "creator",
        },
        {
          onConflict: "id",
        }
      );

      if (profileError) {
        console.error("❌ Error creating/updating profile:", profileError);
        throw profileError;
      }

      // Create creator record
      const { error: creatorError } = await supabase.from("creators").upsert(
        {
          id: creatorId,
          display_name: creatorEmail?.split("@")[0] || "Demo Creator",
          bio: "This is a demo creator profile for testing the Money & Access MVP.",
        },
        {
          onConflict: "id",
        }
      );

      if (creatorError) {
        console.error("❌ Error creating creator:", creatorError);
        throw creatorError;
      }

      console.log(`✅ Created creator profile: ${creatorId}`);
    }

    // 2. Create 3 demo posts
    const posts = [
      {
        creator_id: creatorId,
        title: "Subscriber-Only Content",
        content: "This is exclusive content for subscribers only. Subscribe to unlock!",
        price_cents: 0, // subscriber-only
        cover_url: null,
      },
      {
        creator_id: creatorId,
        title: "Premium PPV Content - $4.99",
        content: "This is a premium pay-per-view post. Unlock it for $4.99!",
        price_cents: 499, // PPV $4.99
        cover_url: null,
      },
      {
        creator_id: creatorId,
        title: "Exclusive PPV Content - $9.99",
        content: "This is an exclusive premium post. Unlock it for $9.99!",
        price_cents: 999, // PPV $9.99
        cover_url: null,
      },
    ];

    const postIds: string[] = [];

    for (const post of posts) {
      const { data: insertedPost, error: postError } = await supabase
        .from("posts")
        .insert(post)
        .select("id")
        .single();

      if (postError) {
        console.error(`❌ Error creating post "${post.title}":`, postError);
        throw postError;
      }

      postIds.push(insertedPost.id);
      console.log(
        `✅ Created post: ${insertedPost.id} - "${post.title}" (${post.price_cents === 0 ? "subscriber-only" : `$${(post.price_cents / 100).toFixed(2)} PPV`})`
      );
    }

    console.log("\n✅ Demo data seeded successfully!");
    console.log(`\n📋 Summary:`);
    console.log(`   Creator ID: ${creatorId}`);
    console.log(`   Posts created: ${postIds.length}`);
    console.log(`   - Post A: Subscriber-only (price_cents=0)`);
    console.log(`   - Post B: PPV $4.99 (price_cents=499)`);
    console.log(`   - Post C: PPV $9.99 (price_cents=999)`);
    console.log(`\n🌐 Visit /creator/${creatorId} to see the posts`);
  } catch (error) {
    console.error("\n❌ Seed failed:", error);
    process.exit(1);
  }
}

seedDemo();
