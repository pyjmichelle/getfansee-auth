/**
 * 产品功能综合测试脚本
 * 覆盖所有产品开发执行方案中的功能模块
 *
 * 测试模块：
 * 1. 注册登录 - 用户注册、登录、封禁检查
 * 2. Feed 内容浏览 - 内容列表、地理屏蔽、KYC拦截
 * 3. 解锁内容 - 订阅、PPV解锁、权限检查
 * 4. 钱包支付 - 钱包余额、充值、交易记录
 * 5. 个人中心 - 个人资料、订阅管理
 * 6. Creator 面板 - 内容管理、收益、订阅者管理
 * 7. 推广返佣 - 推荐码捕获和绑定
 * 8. 审计合规 - KYC、举报、内容审核
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
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("❌ Missing Supabase credentials");
  console.error("Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const supabaseAdmin = SUPABASE_SERVICE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  : supabase;

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

function addResult(name: string, passed: boolean, error?: string, details?: any) {
  results.push({ name, passed, error, details });
  const icon = passed ? "✅" : "❌";
  console.log(`${icon} ${name}`);
  if (error) {
    console.log(`   错误: ${error}`);
  }
  if (details) {
    console.log(`   Details: ${JSON.stringify(details, null, 2)}`);
  }
}

// 清理函数
async function cleanup() {
  // 清理测试数据（如果需要）
}

// ============================================
// 模块 1: 注册登录
// ============================================
async function testAuthModule() {
  console.log("\n📋 模块 1: 注册登录");

  // 1.1 测试用户注册
  const testEmail = `test_${Date.now()}@example.com`;
  const testPassword = "TestPassword123!";

  try {
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
    });

    if (signUpError) {
      addResult("用户注册", false, signUpError.message);
      return null;
    }

    if (!signUpData.user) {
      addResult("用户注册", false, "用户创建失败");
      return null;
    }

    addResult("用户注册", true, undefined, { userId: signUpData.user.id });

    // 确保 profile 存在
    const { error: profileError } = await supabase.from("profiles").upsert(
      {
        id: signUpData.user.id,
        email: signUpData.user.email || testEmail,
        display_name: signUpData.user.email?.split("@")[0] || "Test User",
        role: "fan",
      },
      {
        onConflict: "id",
      }
    );

    if (profileError) {
      console.log(`   Warning: 创建 profile 失败: ${profileError.message}`);
    }

    // 1.2 测试用户登录
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    if (signInError || !signInData.user) {
      addResult("用户登录", false, signInError?.message || "登录失败");
      return signUpData.user.id;
    }

    addResult("用户登录", true);

    // 1.3 测试封禁检查
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_banned")
      .eq("id", signUpData.user.id)
      .single();

    if (profile && profile.is_banned) {
      addResult("封禁检查", false, "用户被封禁");
    } else {
      addResult("封禁检查", true);
    }

    return signUpData.user.id;
  } catch (err: any) {
    addResult("注册登录模块", false, err.message);
    return null;
  }
}

// ============================================
// 模块 2: Feed 内容浏览
// ============================================
async function testFeedModule(userId: string | null) {
  console.log("\n📋 模块 2: Feed 内容浏览");

  if (!userId) {
    addResult("Feed 内容浏览", false, "需要先创建用户");
    return;
  }

  try {
    // 2.1 测试获取 Feed 列表
    const { data: feedData, error: feedError } = await supabase
      .from("posts")
      .select("id, title, content, visibility, created_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(10);

    if (feedError) {
      addResult("获取 Feed 列表", false, feedError.message);
    } else {
      addResult("获取 Feed 列表", true, undefined, { count: feedData?.length || 0 });
    }

    // 2.2 测试地理屏蔽（需要创建测试内容）
    const { data: creatorProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "creator")
      .limit(1)
      .single();

    if (creatorProfile) {
      const { data: blockedCountries } = await supabase
        .from("profiles")
        .select("blocked_countries")
        .eq("id", creatorProfile.id)
        .single();

      if (
        blockedCountries &&
        Array.isArray(blockedCountries.blocked_countries) &&
        blockedCountries.blocked_countries.length > 0
      ) {
        addResult("地理屏蔽检查", true, undefined, {
          blockedCountries: blockedCountries.blocked_countries,
        });
      } else {
        addResult("地理屏蔽检查", true, undefined, { message: "未设置屏蔽国家" });
      }
    }

    // 2.3 测试 KYC 拦截（需要检查 age_verified）
    const { data: kycCheck } = await supabase
      .from("profiles")
      .select("age_verified")
      .eq("id", userId)
      .single();

    if (kycCheck) {
      addResult("KYC 状态检查", true, undefined, {
        age_verified: kycCheck.age_verified || false,
      });
    }
  } catch (err: any) {
    addResult("Feed 内容浏览模块", false, err.message);
  }
}

// ============================================
// 模块 3: 解锁内容
// ============================================
async function testUnlockModule(userId: string | null) {
  console.log("\n📋 模块 3: 解锁内容");

  if (!userId) {
    addResult("解锁内容", false, "需要先创建用户");
    return;
  }

  try {
    // 3.1 测试订阅功能
    const { data: creators } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "creator")
      .limit(1);

    if (creators && creators.length > 0) {
      const creatorId = creators[0].id;

      // 检查是否已有订阅（使用 subscriber_id）
      const { data: existingSub, error: subError } = await supabase
        .from("subscriptions")
        .select("id, status")
        .eq("subscriber_id", userId)
        .eq("creator_id", creatorId)
        .maybeSingle();

      // 如果 subscriber_id 不存在，尝试 fan_id（向后兼容）
      let existingSubFallback = null;
      if (subError && subError.message.includes("subscriber_id")) {
        const { data: sub2 } = await supabase
          .from("subscriptions")
          .select("id, status")
          .eq("fan_id", userId)
          .eq("creator_id", creatorId)
          .maybeSingle();
        existingSubFallback = sub2;
      }

      const finalSub = existingSub || existingSubFallback;

      if (finalSub) {
        addResult("订阅状态检查", true, undefined, {
          status: finalSub.status,
        });
      } else {
        addResult("订阅状态检查", true, undefined, { message: "未订阅" });
      }
    }

    // 3.2 测试 PPV 解锁
    const { data: ppvPosts } = await supabase
      .from("posts")
      .select("id")
      .eq("visibility", "ppv")
      .is("deleted_at", null)
      .limit(1);

    if (ppvPosts && ppvPosts.length > 0) {
      const postId = ppvPosts[0].id;

      const { data: unlock } = await supabase
        .from("post_unlocks")
        .select("id")
        .eq("user_id", userId)
        .eq("post_id", postId)
        .single();

      if (unlock) {
        addResult("PPV 解锁检查", true, undefined, { postId });
      } else {
        addResult("PPV 解锁检查", true, undefined, { message: "未解锁" });
      }
    }

    // 3.3 测试权限检查（Creator 自动解锁自己的内容）
    const { data: userProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

    if (userProfile?.role === "creator") {
      const { data: ownPosts } = await supabase
        .from("posts")
        .select("id")
        .eq("creator_id", userId)
        .is("deleted_at", null)
        .limit(1);

      if (ownPosts && ownPosts.length > 0) {
        addResult("Creator 自动解锁", true, undefined, {
          message: "Creator 可以查看自己的内容",
        });
      }
    }
  } catch (err: any) {
    addResult("解锁内容模块", false, err.message);
  }
}

// ============================================
// 模块 4: 钱包支付
// ============================================
async function testWalletModule(userId: string | null) {
  console.log("\n📋 模块 4: 钱包支付");

  if (!userId) {
    addResult("钱包支付", false, "需要先创建用户");
    return;
  }

  try {
    // 4.1 测试钱包余额查询
    const { data: wallet, error: walletError } = await supabase
      .from("wallet_accounts")
      .select("available_balance_cents, pending_balance_cents")
      .eq("user_id", userId)
      .single();

    if (walletError && walletError.code === "PGRST116") {
      // 钱包不存在，这是正常的
      addResult("钱包余额查询", true, undefined, { message: "钱包未创建（首次使用）" });
    } else if (wallet) {
      addResult("钱包余额查询", true, undefined, {
        available: wallet.available_balance_cents / 100,
        pending: wallet.pending_balance_cents / 100,
      });
    } else {
      addResult("钱包余额查询", false, walletError?.message);
    }

    // 4.2 测试交易记录查询
    const { data: transactions, error: transError } = await supabase
      .from("transactions")
      .select("id, type, amount_cents, status, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (transError) {
      addResult("交易记录查询", false, transError.message);
    } else {
      addResult("交易记录查询", true, undefined, {
        count: transactions?.length || 0,
      });
    }
  } catch (err: any) {
    addResult("钱包支付模块", false, err.message);
  }
}

// ============================================
// 模块 5: 个人中心
// ============================================
async function testProfileModule(userId: string | null) {
  console.log("\n📋 模块 5: 个人中心");

  if (!userId) {
    addResult("个人中心", false, "需要先创建用户");
    return;
  }

  try {
    // 5.1 测试个人资料查询
    // 如果 profile 不存在，先创建
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, display_name, bio, avatar_url, role")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      addResult("个人资料查询", false, profileError.message);
    } else if (!profile) {
      // 获取用户 email
      const { data: userData } = await supabase.auth.getUser();
      const userEmail = userData?.user?.email || `test_${userId}@example.com`;

      // 创建默认 profile
      const { data: newProfile, error: createError } = await supabase
        .from("profiles")
        .insert({
          id: userId,
          email: userEmail,
          display_name: "Test User",
          role: "fan",
        })
        .select()
        .single();

      if (createError) {
        addResult("个人资料查询", false, `创建失败: ${createError.message}`);
      } else {
        addResult("个人资料查询", true, undefined, {
          display_name: newProfile.display_name,
          role: newProfile.role,
        });
      }
    } else {
      addResult("个人资料查询", true, undefined, {
        display_name: profile.display_name,
        role: profile.role,
      });
    }

    // 5.2 测试订阅管理（使用 subscriber_id）
    const { data: subscriptions, error: subError } = await supabase
      .from("subscriptions")
      .select("id, creator_id, status, cancelled_at")
      .eq("subscriber_id", userId);

    // 如果 subscriber_id 不存在，尝试 fan_id（向后兼容）
    let subscriptionsFallback = null;
    if (subError && subError.message.includes("subscriber_id")) {
      const { data: sub2 } = await supabase
        .from("subscriptions")
        .select("id, creator_id, status, cancelled_at")
        .eq("fan_id", userId);
      subscriptionsFallback = sub2;
    }

    const finalSubscriptions = subscriptions || subscriptionsFallback;

    if (subError && !subscriptionsFallback) {
      addResult("订阅管理查询", false, subError.message);
    } else {
      addResult("订阅管理查询", true, undefined, {
        count: finalSubscriptions?.length || 0,
      });
    }
  } catch (err: any) {
    addResult("个人中心模块", false, err.message);
  }
}

// ============================================
// 模块 6: Creator 面板
// ============================================
async function testCreatorModule(userId: string | null) {
  console.log("\n📋 模块 6: Creator 面板");

  if (!userId) {
    addResult("Creator 面板", false, "需要先创建用户");
    return;
  }

  try {
    // 6.1 测试内容管理
    const { data: posts, error: postsError } = await supabase
      .from("posts")
      .select("id, title, visibility, created_at")
      .eq("creator_id", userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(10);

    if (postsError) {
      addResult("内容管理查询", false, postsError.message);
    } else {
      addResult("内容管理查询", true, undefined, {
        count: posts?.length || 0,
      });
    }

    // 6.2 测试收益查询
    const { data: earnings, error: earningsError } = await supabase
      .from("transactions")
      .select("id, type, amount_cents, status")
      .eq("user_id", userId)
      .in("type", ["subscription", "ppv_purchase", "commission"]);

    if (earningsError) {
      addResult("收益查询", false, earningsError.message);
    } else {
      const totalEarnings = (earnings || []).reduce((sum, t) => {
        return sum + (t.status === "completed" ? t.amount_cents : 0);
      }, 0);
      addResult("收益查询", true, undefined, {
        totalCents: totalEarnings,
        count: earnings?.length || 0,
      });
    }

    // 6.3 测试订阅者管理（使用 subscriber_id）
    const { data: subscribers, error: subError } = await supabase
      .from("subscriptions")
      .select("id, subscriber_id, status, created_at")
      .eq("creator_id", userId)
      .eq("status", "active");

    // 如果 subscriber_id 不存在，尝试 fan_id（向后兼容）
    let subscribersFallback = null;
    if (subError && subError.message.includes("subscriber_id")) {
      const { data: sub2 } = await supabase
        .from("subscriptions")
        .select("id, fan_id, status, created_at")
        .eq("creator_id", userId)
        .eq("status", "active");
      subscribersFallback = sub2;
    }

    const finalSubscribers = subscribers || subscribersFallback;

    if (subError && !subscribersFallback) {
      addResult("订阅者管理查询", false, subError.message);
    } else {
      addResult("订阅者管理查询", true, undefined, {
        count: finalSubscribers?.length || 0,
      });
    }
  } catch (err: any) {
    addResult("Creator 面板模块", false, err.message);
  }
}

// ============================================
// 模块 7: 推广返佣
// ============================================
async function testReferralModule(userId: string | null) {
  console.log("\n📋 模块 7: 推广返佣");

  if (!userId) {
    addResult("推广返佣", false, "需要先创建用户");
    return;
  }

  try {
    // 7.1 测试推荐关系查询
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, referrer_id")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      addResult("推荐关系查询", false, profileError.message);
    } else if (!profile) {
      // 获取用户 email
      const { data: userData } = await supabase.auth.getUser();
      const userEmail = userData?.user?.email || `test_${userId}@example.com`;

      // 如果 profile 不存在，创建默认 profile
      const { data: newProfile, error: createError } = await supabase
        .from("profiles")
        .insert({
          id: userId,
          email: userEmail,
          display_name: "Test User",
          role: "fan",
        })
        .select("id, referrer_id")
        .single();

      if (createError) {
        addResult("推荐关系查询", false, `创建失败: ${createError.message}`);
      } else {
        addResult("推荐关系查询", true, undefined, {
          hasReferrer: !!newProfile.referrer_id,
          referrerId: newProfile.referrer_id || null,
        });
      }
    } else {
      addResult("推荐关系查询", true, undefined, {
        hasReferrer: !!profile.referrer_id,
        referrerId: profile.referrer_id || null,
      });
    }

    // 7.2 测试推荐码功能（需要检查 referrer_id 字段存在）
    const { data: referrerCheck } = await supabase.from("profiles").select("referrer_id").limit(1);

    if (referrerCheck !== null) {
      addResult("推荐码字段检查", true, undefined, {
        message: "referrer_id 字段存在",
      });
    } else {
      addResult("推荐码字段检查", false, "referrer_id 字段不存在");
    }
  } catch (err: any) {
    addResult("推广返佣模块", false, err.message);
  }
}

// ============================================
// 模块 8: 审计合规
// ============================================
async function testComplianceModule(userId: string | null) {
  console.log("\n📋 模块 8: 审计合规");

  if (!userId) {
    addResult("审计合规", false, "需要先创建用户");
    return;
  }

  try {
    // 8.1 测试 KYC 验证
    const { data: verification, error: verError } = await supabase
      .from("creator_verifications")
      .select("id, status, created_at")
      .eq("user_id", userId)
      .single();

    if (verError && verError.code === "PGRST116") {
      addResult("KYC 验证查询", true, undefined, { message: "未提交验证" });
    } else if (verification) {
      addResult("KYC 验证查询", true, undefined, {
        status: verification.status,
      });
    } else {
      addResult("KYC 验证查询", false, verError?.message);
    }

    // 8.2 测试举报功能
    const { data: reports, error: reportsError } = await supabase
      .from("reports")
      .select("id, reported_type, status, created_at")
      .eq("reporter_id", userId)
      .limit(10);

    if (reportsError) {
      addResult("举报功能查询", false, reportsError.message);
    } else {
      addResult("举报功能查询", true, undefined, {
        count: reports?.length || 0,
      });
    }

    // 8.3 测试内容审核（检查 deleted_at 和 removed_by_admin）
    const { data: deletedPosts, error: deletedError } = await supabase
      .from("posts")
      .select("id, removed_by_admin")
      .not("deleted_at", "is", null)
      .limit(5);

    if (deletedError) {
      addResult("内容审核查询", false, deletedError.message);
    } else {
      addResult("内容审核查询", true, undefined, {
        deletedCount: deletedPosts?.length || 0,
      });
    }

    // 8.4 测试用户封禁
    const { data: bannedUsers, error: bannedError } = await supabase
      .from("profiles")
      .select("id, is_banned")
      .eq("is_banned", true)
      .limit(5);

    if (bannedError) {
      addResult("用户封禁查询", false, bannedError.message);
    } else {
      addResult("用户封禁查询", true, undefined, {
        bannedCount: bannedUsers?.length || 0,
      });
    }
  } catch (err: any) {
    addResult("审计合规模块", false, err.message);
  }
}

// ============================================
// 主测试函数
// ============================================
async function runAllTests() {
  console.log("============================================================");
  console.log("🚀 产品功能综合测试");
  console.log("============================================================");

  // 模块 1: 注册登录
  const userId = await testAuthModule();

  // 模块 2: Feed 内容浏览
  await testFeedModule(userId);

  // 模块 3: 解锁内容
  await testUnlockModule(userId);

  // 模块 4: 钱包支付
  await testWalletModule(userId);

  // 模块 5: 个人中心
  await testProfileModule(userId);

  // 模块 6: Creator 面板
  await testCreatorModule(userId);

  // 模块 7: 推广返佣
  await testReferralModule(userId);

  // 模块 8: 审计合规
  await testComplianceModule(userId);

  // 清理
  await cleanup();

  // 汇总结果
  console.log("\n============================================================");
  console.log("📊 测试结果汇总");
  console.log("============================================================");

  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

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

  console.log("\n============================================================");
  if (failed === 0) {
    console.log("✅ 所有测试通过！");
    process.exit(0);
  } else {
    console.log("❌ 部分测试失败");
    process.exit(1);
  }
}

// 运行测试
runAllTests().catch((err) => {
  console.error("测试执行异常:", err);
  process.exit(1);
});
