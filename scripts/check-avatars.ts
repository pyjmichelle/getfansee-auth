/**
 * 检查头像数据脚本
 * 检查 profiles 和 creators 表中的头像数据
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join } from "path";

function loadEnv() {
  const env: Record<string, string> = {};

  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  }
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  }

  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
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
      // .env.local not found
    }
  }

  return env;
}

const env = loadEnv();
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("❌ Missing environment variables");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function checkAvatars() {
  console.log("🔍 检查头像数据...\n");

  try {
    // 获取所有 demo creators
    const demoCreatorNames = [
      "Sophia Creative",
      "Alex Photography",
      "Maya Lifestyle",
      "Jordan Fitness",
      "Taylor Music",
    ];

    for (const name of demoCreatorNames) {
      console.log(`\n📋 检查: ${name}`);

      // 从 creators 表获取
      const { data: creator, error: creatorError } = await supabase
        .from("creators")
        .select("id, display_name, avatar_url")
        .eq("display_name", name)
        .maybeSingle();

      if (creatorError) {
        console.error(`  ❌ Creators 表查询失败:`, creatorError);
        continue;
      }

      if (!creator) {
        console.log(`  ⚠️  Creator 不存在`);
        continue;
      }

      console.log(`  ✅ Creator ID: ${creator.id}`);
      console.log(`  ✅ Creator avatar_url: ${creator.avatar_url || "NULL"}`);

      // 从 profiles 表获取
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .eq("id", creator.id)
        .maybeSingle();

      if (profileError) {
        console.error(`  ❌ Profiles 表查询失败:`, profileError);
        continue;
      }

      if (!profile) {
        console.log(`  ⚠️  Profile 不存在`);
        continue;
      }

      console.log(`  ✅ Profile avatar_url: ${profile.avatar_url || "NULL"}`);

      // 检查是否一致
      if (creator.avatar_url && creator.avatar_url !== profile.avatar_url) {
        console.log(`  ⚠️  头像不一致！正在同步...`);
        const { error: updateError } = await supabase
          .from("profiles")
          .update({ avatar_url: creator.avatar_url })
          .eq("id", creator.id);

        if (updateError) {
          console.error(`  ❌ 同步失败:`, updateError);
        } else {
          console.log(`  ✅ 已同步头像到 profiles 表`);
        }
      } else if (!profile.avatar_url && creator.avatar_url) {
        console.log(`  ⚠️  Profile 缺少头像，正在添加...`);
        const { error: updateError } = await supabase
          .from("profiles")
          .update({ avatar_url: creator.avatar_url })
          .eq("id", creator.id);

        if (updateError) {
          console.error(`  ❌ 添加失败:`, updateError);
        } else {
          console.log(`  ✅ 已添加头像到 profiles 表`);
        }
      } else {
        console.log(`  ✅ 头像数据一致`);
      }
    }

    console.log("\n✅ 检查完成！");
  } catch (error) {
    console.error("❌ 检查失败:", error);
    process.exit(1);
  }
}

checkAvatars();
