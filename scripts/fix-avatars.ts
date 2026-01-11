/**
 * 修复头像 URL：同步 creators 表的 avatar_url 到 profiles 表
 *
 * 使用方法：
 *   pnpm tsx scripts/fix-avatars.ts
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

async function fixAvatars() {
  console.log("🔧 开始修复头像 URL...\n");

  try {
    // 获取所有 creators
    const { data: creators, error: creatorsError } = await supabase
      .from("creators")
      .select("id, avatar_url");

    if (creatorsError) {
      console.error("❌ 获取 creators 失败:", creatorsError);
      return;
    }

    if (!creators || creators.length === 0) {
      console.log("⚠️  没有找到 creators");
      return;
    }

    console.log(`找到 ${creators.length} 个 creators\n`);

    // 更新每个 creator 的 profiles.avatar_url
    for (const creator of creators) {
      if (!creator.avatar_url) {
        console.log(`⚠️  Creator ${creator.id} 没有 avatar_url，跳过`);
        continue;
      }

      // 检查 profiles 表中的当前值
      const { data: currentProfile } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("id", creator.id)
        .maybeSingle();

      // 如果已经是最新的，跳过
      if (currentProfile?.avatar_url === creator.avatar_url) {
        console.log(`✅ Profile ${creator.id} 头像已是最新`);
        continue;
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: creator.avatar_url })
        .eq("id", creator.id);

      if (updateError) {
        console.error(`❌ 更新 profile ${creator.id} 失败:`, updateError);
      } else {
        console.log(`✅ 已更新 profile ${creator.id} 的头像: ${creator.avatar_url}`);
      }
    }

    console.log("\n✅ 头像修复完成！");
  } catch (error) {
    console.error("❌ 修复失败:", error);
    process.exit(1);
  }
}

fixAvatars();
