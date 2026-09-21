/**
 * 创建测试账号脚本
 *
 * 使用方法：
 *   pnpm tsx scripts/create-test-users.ts
 *
 * 前置条件：
 *   - 需要 SUPABASE_SERVICE_ROLE_KEY（在 .env.local 中配置）
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join } from "path";

// 加载环境变量
function loadEnv() {
  const env: Record<string, string> = {};

  // 优先从 process.env 读取
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  }
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  }

  // 从 .env.local 读取
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
const testUserPassword = process.env.E2E_TEST_USER_PASSWORD;

if (!supabaseUrl || !serviceKey) {
  console.error("❌ Missing environment variables:");
  console.error("   - NEXT_PUBLIC_SUPABASE_URL");
  console.error("   - SUPABASE_SERVICE_ROLE_KEY");
  console.error("\n请在 .env.local 中配置这些变量");
  process.exit(1);
}

if (!testUserPassword) {
  console.error("❌ E2E_TEST_USER_PASSWORD is required; test credentials must not be committed.");
  process.exit(1);
}

const actualProjectRef = new URL(supabaseUrl).hostname.split(".")[0];
const allowedProjectRef = process.env.E2E_SUPABASE_PROJECT_REF;
if (!allowedProjectRef || allowedProjectRef !== actualProjectRef) {
  console.error(
    "❌ Refusing to create test users: set E2E_SUPABASE_PROJECT_REF to the dedicated test project's ref."
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

// 测试账号配置
const testUsers = [
  {
    email: "test-fan@example.com",
    password: testUserPassword,
    role: "fan" as const,
    displayName: "Test Fan",
  },
  {
    email: "test-creator@example.com",
    password: testUserPassword,
    role: "creator" as const,
    displayName: "Test Creator",
  },
];

async function findUserByEmail(email: string) {
  const normalizedEmail = email.toLowerCase();
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      console.error("❌ 无法列出用户:", error);
      return null;
    }
    const user = data?.users.find((u) => u.email?.toLowerCase() === normalizedEmail);
    if (user) {
      return user;
    }
    if (!data?.users?.length) {
      break;
    }
  }
  return null;
}

async function createTestUsers() {
  console.log("🔧 开始创建测试账号...\n");

  for (const userConfig of testUsers) {
    try {
      console.log(`📝 处理账号: ${userConfig.email}`);

      // 1. 检查用户是否已存在
      const existingUser = await findUserByEmail(userConfig.email);

      if (existingUser) {
        console.log(`   ⚠️  用户已存在: ${existingUser.id}`);

        // 更新密码（如果需要）
        const { error: updateError } = await supabase.auth.admin.updateUserById(existingUser.id, {
          password: userConfig.password,
        });

        if (updateError) {
          console.error(`   ❌ 更新密码失败:`, updateError);
        } else {
          console.log(`   ✅ 密码已更新`);
        }
      } else {
        // 2. 创建新用户
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
          email: userConfig.email,
          password: userConfig.password,
          email_confirm: true, // 直接确认邮箱，无需验证
        });

        if (createError) {
          if (createError.code === "email_exists") {
            const fallbackUser = await findUserByEmail(userConfig.email);
            if (!fallbackUser) {
              console.error(`   ❌ 创建用户失败:`, createError);
              continue;
            }
          } else {
            console.error(`   ❌ 创建用户失败:`, createError);
            continue;
          }
        } else {
          console.log(`   ✅ 用户创建成功: ${newUser.user.id}`);
        }
      }

      // 3. 确保 profile 存在
      const userId = existingUser?.id || (await findUserByEmail(userConfig.email))?.id;

      if (!userId) {
        console.error(`   ❌ 无法获取用户 ID`);
        continue;
      }

      const username = userConfig.email
        .split("@")[0]
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
      const { error: profileError } = await supabase.from("profiles").upsert(
        {
          id: userId,
          email: userConfig.email,
          username,
          display_name: userConfig.displayName,
          role: userConfig.role,
          age_verified: true, // 测试账号默认已验证年龄
        },
        {
          onConflict: "id",
        }
      );

      if (profileError) {
        console.error(`   ❌ 创建 profile 失败:`, profileError);
        continue;
      }

      console.log(`   ✅ Profile 创建/更新成功`);

      // 4. 如果是 creator，确保 creators 表中有记录
      if (userConfig.role === "creator") {
        const { error: creatorError } = await supabase.from("creators").upsert(
          {
            id: userId,
            display_name: userConfig.displayName,
            bio: "This is a test creator account for external testing.",
          },
          {
            onConflict: "id",
          }
        );

        if (creatorError) {
          console.error(`   ❌ 创建 creator 记录失败:`, creatorError);
        } else {
          console.log(`   ✅ Creator 记录创建/更新成功`);
        }
      }

      console.log(`   ✅ 账号 ${userConfig.email} 准备完成\n`);
    } catch (err: any) {
      console.error(`❌ 处理账号 ${userConfig.email} 时出错:`, err.message);
    }
  }

  console.log("✅ 测试账号创建完成！\n");
  console.log("📋 测试账号：\n");
  testUsers.forEach((user) => {
    console.log(`   邮箱: ${user.email}`);
    console.log(`   角色: ${user.role}`);
    console.log("");
  });
  console.log("⚠️  密码仅从 E2E_TEST_USER_PASSWORD 读取，不会写入日志。");
}

createTestUsers()
  .then(() => {
    console.log("✅ Test users setup completed");
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ 脚本执行失败:", err);
    process.exit(1);
  });
