/**
 * 隐私逻辑自动化审计脚本
 * 测试场景：
 * A. 地理屏蔽：创作者屏蔽国家后，该国家访客无法获取内容
 * B. KYC 拦截：未完成身份验证的用户无法创建 PPV 或订阅内容
 * C. 普通用户不受地理屏蔽限制（除非被显式屏蔽）
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join } from "path";

// 加载环境变量
function loadEnv() {
  try {
    const envPath = join(process.cwd(), ".env.local");
    const envContent = readFileSync(envPath, "utf-8");
    const envLines = envContent.split("\n");

    for (const line of envLines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const [key, ...valueParts] = trimmed.split("=");
        if (key && valueParts.length > 0) {
          const value = valueParts
            .join("=")
            .trim()
            .replace(/^["']|["']$/g, "");
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      }
    }
  } catch (err) {
    // .env.local 不存在或无法读取，使用 process.env
  }
}

loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("❌ Missing Supabase credentials");
  console.error("Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

function recordTest(name: string, passed: boolean, error?: string, details?: any) {
  results.push({ name, passed, error, details });
  const icon = passed ? "✅" : "❌";
  console.log(`${icon} ${name}`);
  if (error) {
    console.log(`   Error: ${error}`);
  }
  if (details) {
    console.log(`   Details:`, JSON.stringify(details, null, 2));
  }
}

/**
 * 场景 A: 地理屏蔽测试
 * 模拟创作者 A 屏蔽了"日本 (JP)"，验证当 Header 中 country 为 'JP' 时，无法获取 A 的内容
 */
async function testGeoBlocking() {
  console.log("\n📋 Test A: 地理屏蔽逻辑");

  try {
    // 1. 创建创作者用户
    const creatorEmail = `test-creator-geo-${Date.now()}@example.com`;
    const password = "test-password-123";

    const { data: creatorSignUp, error: creatorError } = await supabase.auth.signUp({
      email: creatorEmail,
      password: password,
    });

    if (creatorError || !creatorSignUp.user) {
      recordTest("创建创作者用户", false, creatorError?.message);
      return;
    }
    recordTest("创建创作者用户", true);

    const creatorId = creatorSignUp.user.id;

    // 2. 设置创作者角色并屏蔽日本 (JP)
    // 注意：如果 blocked_countries 字段不存在，先尝试更新其他字段
    const { error: profileError } = await supabase.from("profiles").upsert(
      {
        id: creatorId,
        email: creatorEmail,
        role: "creator",
        display_name: "Geo Blocked Creator",
        age_verified: true,
        // blocked_countries 字段需要先执行迁移 015_geo_blocking_kyc.sql
        // 如果字段不存在，这里会报错，但测试会继续验证逻辑
      },
      { onConflict: "id" }
    );

    // 如果字段存在，更新 blocked_countries
    if (!profileError) {
      await supabase
        .from("profiles")
        .update({ blocked_countries: ["JP"] })
        .eq("id", creatorId);
    }

    if (profileError) {
      // 检查是否是字段不存在的错误
      if (profileError.message.includes("blocked_countries")) {
        recordTest(
          "设置创作者并屏蔽日本（需要执行迁移 015_geo_blocking_kyc.sql）",
          false,
          profileError.message
        );
        console.log("   ⚠️  请先执行 migrations/015_geo_blocking_kyc.sql");
        return;
      }
      recordTest("设置创作者并屏蔽日本", false, profileError.message);
      return;
    }
    recordTest("设置创作者并屏蔽日本 (JP)", true);

    await supabase.from("creators").upsert(
      {
        id: creatorId,
        display_name: "Geo Blocked Creator",
      },
      { onConflict: "id" }
    );

    // 3. 创建测试 post
    const { data: postData, error: postError } = await supabase
      .from("posts")
      .insert({
        creator_id: creatorId,
        content: "Test post for geo blocking",
        visibility: "free",
        price_cents: 0,
      })
      .select()
      .single();

    if (postError || !postData) {
      recordTest("创建测试 post", false, postError?.message);
      return;
    }
    recordTest("创建测试 post", true, undefined, { post_id: postData.id });

    const postId = postData.id;

    // 4. 验证 blocked_countries 已设置
    const { data: profileCheck } = await supabase
      .from("profiles")
      .select("blocked_countries")
      .eq("id", creatorId)
      .single();

    if (profileCheck?.blocked_countries?.includes("JP")) {
      recordTest("验证 blocked_countries 包含 JP", true);
    } else {
      recordTest(
        "验证 blocked_countries 包含 JP",
        false,
        `blocked_countries: ${JSON.stringify(profileCheck?.blocked_countries)}`
      );
      return;
    }

    // 5. 模拟日本访客（country = 'JP'）尝试获取内容
    // 使用 listCreatorPosts 函数，传入 visitorCountry = 'JP'
    const { listCreatorPosts } = await import("../lib/posts");

    // 先验证能够查询到 creator 的 profile（检查 RLS 策略）
    const { data: profileCheckForRLS, error: profileCheckError } = await supabase
      .from("profiles")
      .select("blocked_countries")
      .eq("id", creatorId)
      .single();

    if (profileCheckError) {
      recordTest(
        "日本访客无法获取内容（被屏蔽）",
        false,
        `Cannot query creator profile (RLS may block). Error: ${profileCheckError.message}. Please execute migrations/016_geo_blocking_rls_fix.sql`
      );
      console.log(
        "   ⚠️  请先执行 migrations/016_geo_blocking_rls_fix.sql 以允许查询 creator 的 profile"
      );
      return;
    }

    if (!profileCheckForRLS?.blocked_countries?.includes("JP")) {
      recordTest(
        "日本访客无法获取内容（被屏蔽）",
        false,
        `blocked_countries does not include JP: ${JSON.stringify(profileCheckForRLS?.blocked_countries)}`
      );
      return;
    }

    // 模拟日本访客
    const jpPosts = await listCreatorPosts(creatorId, "JP");

    console.log(`[test] JP posts count: ${jpPosts.length}`);

    if (jpPosts.length === 0) {
      recordTest("日本访客无法获取内容（被屏蔽）", true);
    } else {
      recordTest(
        "日本访客无法获取内容（被屏蔽）",
        false,
        `Expected empty array, got ${jpPosts.length} posts`
      );
      // 调试：检查为什么没有被屏蔽
      console.log(`[test] Debug: First post data:`, JSON.stringify(jpPosts[0], null, 2));
      return;
    }

    // 5. 模拟美国访客（country = 'US'）尝试获取内容
    const usPosts = await listCreatorPosts(creatorId, "US");

    if (usPosts.length > 0) {
      recordTest("美国访客可以获取内容（未被屏蔽）", true, undefined, {
        post_count: usPosts.length,
      });
    } else {
      recordTest("美国访客可以获取内容（未被屏蔽）", false, "Expected posts, got empty array");
    }

    // 6. 测试 Feed 中的地理屏蔽
    const { listFeed } = await import("../lib/posts");

    // 日本访客的 Feed（应该不包含被屏蔽的 creator 的 posts）
    const jpFeed = await listFeed(20, "JP");
    const hasBlockedCreatorPost = jpFeed.some((p) => p.creator_id === creatorId);

    if (!hasBlockedCreatorPost) {
      recordTest("Feed 中不包含被屏蔽 creator 的内容（日本访客）", true);
    } else {
      recordTest(
        "Feed 中不包含被屏蔽 creator 的内容（日本访客）",
        false,
        "Found blocked creator's post in feed"
      );
    }

    // 7. 清理
    await supabase.from("posts").delete().eq("id", postId);
    await supabase.auth.admin.deleteUser(creatorId);
    recordTest("清理测试数据", true);
  } catch (err: any) {
    recordTest("场景 A 执行", false, err.message);
  }
}

/**
 * 场景 B: KYC 拦截测试
 * 验证当 age_verified 为 false 时，该用户无法创建任何 PPV 或订阅帖子
 */
async function testKYCBlocking() {
  console.log("\n📋 Test B: KYC 拦截逻辑");

  try {
    // 1. 创建未完成 KYC 的创作者
    const creatorEmail = `test-creator-kyc-${Date.now()}@example.com`;
    const password = "test-password-123";

    const { data: creatorSignUp, error: creatorError } = await supabase.auth.signUp({
      email: creatorEmail,
      password: password,
    });

    if (creatorError || !creatorSignUp.user) {
      recordTest("创建创作者用户", false, creatorError?.message);
      return;
    }
    recordTest("创建创作者用户", true);

    const creatorId = creatorSignUp.user.id;

    // 2. 设置创作者角色，但 age_verified = false
    const { error: profileError } = await supabase.from("profiles").upsert(
      {
        id: creatorId,
        email: creatorEmail,
        role: "creator",
        display_name: "Unverified Creator",
        age_verified: false, // 未完成 KYC
      },
      { onConflict: "id" }
    );

    if (profileError) {
      recordTest("设置创作者（未完成 KYC）", false, profileError.message);
      return;
    }
    recordTest("设置创作者（age_verified = false）", true);

    await supabase.from("creators").upsert(
      {
        id: creatorId,
        display_name: "Unverified Creator",
      },
      { onConflict: "id" }
    );

    // 3. 尝试创建 PPV post（应该失败）
    const { createPost } = await import("../lib/posts");

    const ppvPostId = await createPost({
      content: "Test PPV post",
      visibility: "ppv",
      price_cents: 500,
    });

    if (ppvPostId === null) {
      recordTest("无法创建 PPV post（KYC 未完成）", true);
    } else {
      recordTest("无法创建 PPV post（KYC 未完成）", false, "Expected null, got post ID");
      // 清理
      await supabase.from("posts").delete().eq("id", ppvPostId);
    }

    // 4. 尝试创建订阅者专享 post（应该失败）
    const subscriberPostId = await createPost({
      content: "Test subscriber post",
      visibility: "subscribers",
      price_cents: 0,
    });

    if (subscriberPostId === null) {
      recordTest("无法创建订阅者专享 post（KYC 未完成）", true);
    } else {
      recordTest("无法创建订阅者专享 post（KYC 未完成）", false, "Expected null, got post ID");
      // 清理
      await supabase.from("posts").delete().eq("id", subscriberPostId);
    }

    // 5. 可以创建免费 post（不受 KYC 限制）
    // 注意：createPost 需要用户 session，这里直接使用 supabase 插入
    const { data: freePostData, error: freePostError } = await supabase
      .from("posts")
      .insert({
        creator_id: creatorId,
        content: "Test free post",
        visibility: "free",
        price_cents: 0,
      })
      .select()
      .single();

    if (freePostError || !freePostData) {
      recordTest(
        "可以创建免费 post（不受 KYC 限制）",
        false,
        freePostError?.message || "Failed to create post"
      );
    } else {
      recordTest("可以创建免费 post（不受 KYC 限制）", true, undefined, {
        post_id: freePostData.id,
      });

      // 清理
      await supabase.from("posts").delete().eq("id", freePostData.id);
    }

    // 6. 清理
    await supabase.auth.admin.deleteUser(creatorId);
    recordTest("清理测试数据", true);
  } catch (err: any) {
    recordTest("场景 B 执行", false, err.message);
  }
}

/**
 * 场景 C: 普通用户不受地理屏蔽限制
 * 验证普通用户（非被屏蔽国家）可以正常访问内容
 */
async function testNormalUserAccess() {
  console.log("\n📋 Test C: 普通用户不受地理屏蔽限制");

  try {
    // 1. 创建创作者（不屏蔽任何国家）
    const creatorEmail = `test-creator-normal-${Date.now()}@example.com`;
    const password = "test-password-123";

    const { data: creatorSignUp, error: creatorError } = await supabase.auth.signUp({
      email: creatorEmail,
      password: password,
    });

    if (creatorError || !creatorSignUp.user) {
      recordTest("创建创作者用户", false, creatorError?.message);
      return;
    }
    recordTest("创建创作者用户", true);

    const creatorId = creatorSignUp.user.id;

    // 2. 设置创作者（不屏蔽任何国家）
    const { error: profileError } = await supabase.from("profiles").upsert(
      {
        id: creatorId,
        email: creatorEmail,
        role: "creator",
        display_name: "Normal Creator",
        age_verified: true,
      },
      { onConflict: "id" }
    );

    // 如果字段存在，设置 blocked_countries 为空数组
    if (!profileError) {
      await supabase.from("profiles").update({ blocked_countries: [] }).eq("id", creatorId);
    }

    if (profileError) {
      // 检查是否是字段不存在的错误
      if (profileError.message.includes("blocked_countries")) {
        recordTest(
          "设置创作者（不屏蔽任何国家）（需要执行迁移 015_geo_blocking_kyc.sql）",
          false,
          profileError.message
        );
        console.log("   ⚠️  请先执行 migrations/015_geo_blocking_kyc.sql");
        return;
      }
      recordTest("设置创作者（不屏蔽任何国家）", false, profileError.message);
      return;
    }
    recordTest("设置创作者（不屏蔽任何国家）", true);

    await supabase.from("creators").upsert(
      {
        id: creatorId,
        display_name: "Normal Creator",
      },
      { onConflict: "id" }
    );

    // 3. 创建测试 post
    const { data: postData, error: postError } = await supabase
      .from("posts")
      .insert({
        creator_id: creatorId,
        content: "Test post for normal access",
        visibility: "free",
        price_cents: 0,
      })
      .select()
      .single();

    if (postError || !postData) {
      recordTest("创建测试 post", false, postError?.message);
      return;
    }
    recordTest("创建测试 post", true, undefined, { post_id: postData.id });

    const postId = postData.id;

    // 4. 测试不同国家的访客都可以访问
    const { listCreatorPosts } = await import("../lib/posts");

    const testCountries = ["US", "CN", "JP", "GB", "FR"];
    let allCountriesCanAccess = true;

    for (const country of testCountries) {
      const posts = await listCreatorPosts(creatorId, country);
      if (posts.length === 0) {
        allCountriesCanAccess = false;
        recordTest(`国家 ${country} 可以访问内容`, false, "Expected posts, got empty array");
        break;
      }
    }

    if (allCountriesCanAccess) {
      recordTest("所有国家都可以访问内容（未被屏蔽）", true, undefined, {
        tested_countries: testCountries,
      });
    }

    // 5. 清理
    await supabase.from("posts").delete().eq("id", postId);
    await supabase.auth.admin.deleteUser(creatorId);
    recordTest("清理测试数据", true);
  } catch (err: any) {
    recordTest("场景 C 执行", false, err.message);
  }
}

/**
 * 主函数
 */
async function main() {
  console.log("=".repeat(60));
  console.log("🔒 隐私逻辑自动化审计");
  console.log("=".repeat(60));

  await testGeoBlocking();
  await testKYCBlocking();
  await testNormalUserAccess();

  // 汇总结果
  console.log("\n" + "=".repeat(60));
  console.log("📊 测试结果汇总");
  console.log("=".repeat(60));

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;

  console.log(`总计: ${total} 个测试`);
  console.log(`✅ 通过: ${passed}`);
  console.log(`❌ 失败: ${failed}`);

  if (failed > 0) {
    console.log("\n失败的测试:");
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`  ❌ ${r.name}`);
        if (r.error) {
          console.log(`     错误: ${r.error}`);
        }
      });
  }

  console.log("\n" + "=".repeat(60));
  if (failed === 0) {
    console.log("✅ 审计通过 - 所有测试通过");
    process.exit(0);
  } else {
    console.log("❌ 审计失败 - 部分测试失败");
    process.exit(1);
  }
}

// 运行测试
main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
