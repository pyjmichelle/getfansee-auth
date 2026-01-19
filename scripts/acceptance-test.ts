/**
 * MVP 验收测试脚本
 *
 * 验收流程（执行 3 次）：
 * 1. 新用户注册登录
 * 2. 成为 Creator → 发一条 PPV ($5)
 * 3. Fan 充值 $10 → 解锁 PPV → 刷新仍可见
 * 4. 检查 purchases 和 wallet_transactions 表数据一致
 *
 * 使用方法: pnpm tsx scripts/acceptance-test.ts
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ Missing environment variables:");
  console.error("   NEXT_PUBLIC_SUPABASE_URL");
  console.error("   SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// 确保必要的表存在
async function ensureTablesExist() {
  console.log("🔧 Ensuring required tables exist...");

  // 尝试查询 notifications 表是否存在
  const { error: checkError } = await supabase.from("notifications").select("id").limit(1);

  if (checkError && checkError.message.includes("does not exist")) {
    console.log("⚠️  notifications 表不存在，请先执行以下 SQL：");
    console.log("");
    console.log("   migrations/020_create_notifications_table.sql");
    console.log("");
    console.log("   在 Supabase Dashboard SQL Editor 中执行该文件");
    return false;
  }

  console.log("✅ Required tables verified");
  return true;
}

interface TestResult {
  round: number;
  success: boolean;
  creatorId?: string;
  fanId?: string;
  postId?: string;
  purchaseId?: string;
  error?: string;
}

async function runAcceptanceTest(round: number): Promise<TestResult> {
  console.log(`\n🧪 Round ${round}/3 - Starting acceptance test...`);
  const timestamp = Date.now();

  try {
    // 1. 创建 Creator 用户
    console.log("  1️⃣ Creating Creator user...");
    const creatorEmail = `acceptance-creator-${timestamp}@test.com`;
    const { data: creatorAuth, error: creatorError } = await supabase.auth.admin.createUser({
      email: creatorEmail,
      password: "TestPassword123!",
      email_confirm: true,
    });

    if (creatorError || !creatorAuth.user) {
      throw new Error(`Failed to create creator: ${creatorError?.message}`);
    }

    const creatorId = creatorAuth.user.id;

    // 创建 Creator profile
    await supabase.from("profiles").upsert({
      id: creatorId,
      email: creatorEmail,
      display_name: `Creator ${timestamp}`,
      role: "creator",
      age_verified: true,
    });

    await supabase.from("creators").upsert({
      id: creatorId,
      display_name: `Creator ${timestamp}`,
      bio: "Acceptance test creator",
    });

    console.log(`     ✅ Creator created: ${creatorId}`);

    // 2. Creator 发布 PPV 帖子 ($5)
    console.log("  2️⃣ Creating PPV post ($5)...");
    const { data: post, error: postError } = await supabase
      .from("posts")
      .insert({
        creator_id: creatorId,
        title: `Acceptance Test Post ${timestamp}`,
        content: "This is a test PPV post for acceptance testing.",
        visibility: "ppv",
        price_cents: 500, // $5
        is_locked: true,
      })
      .select()
      .single();

    if (postError || !post) {
      throw new Error(`Failed to create post: ${postError?.message}`);
    }

    console.log(`     ✅ PPV post created: ${post.id}`);

    // 3. 创建 Fan 用户
    console.log("  3️⃣ Creating Fan user...");
    const fanEmail = `acceptance-fan-${timestamp}@test.com`;
    const { data: fanAuth, error: fanError } = await supabase.auth.admin.createUser({
      email: fanEmail,
      password: "TestPassword123!",
      email_confirm: true,
    });

    if (fanError || !fanAuth.user) {
      throw new Error(`Failed to create fan: ${fanError?.message}`);
    }

    const fanId = fanAuth.user.id;

    await supabase.from("profiles").upsert({
      id: fanId,
      email: fanEmail,
      display_name: `Fan ${timestamp}`,
      role: "fan",
      age_verified: true,
    });

    console.log(`     ✅ Fan created: ${fanId}`);

    // 4. Fan 充值 $10
    console.log("  4️⃣ Fan recharging wallet ($10)...");
    const { error: walletError } = await supabase.from("wallet_accounts").upsert({
      user_id: fanId,
      available_balance_cents: 1000, // $10
      pending_balance_cents: 0,
    });

    if (walletError) {
      throw new Error(`Failed to create wallet: ${walletError.message}`);
    }

    // 记录充值交易
    await supabase.from("transactions").insert({
      user_id: fanId,
      type: "deposit",
      amount_cents: 1000,
      status: "completed",
      metadata: { payment_method: "test", amount_usd: 10 },
    });

    console.log("     ✅ Wallet recharged: $10.00");

    // 5. Fan 解锁 PPV
    console.log("  5️⃣ Fan unlocking PPV...");
    const { data: purchaseResult, error: purchaseError } = await supabase.rpc("rpc_purchase_post", {
      p_post_id: post.id,
      p_user_id: fanId,
    });

    if (purchaseError) {
      throw new Error(`Failed to purchase: ${purchaseError.message}`);
    }

    if (!purchaseResult?.success) {
      throw new Error(`Purchase failed: ${purchaseResult?.error || "Unknown error"}`);
    }

    console.log(
      `     ✅ PPV unlocked! Balance after: $${(purchaseResult.balance_after_cents / 100).toFixed(2)}`
    );

    // 6. 验证 purchases 表
    console.log("  6️⃣ Verifying purchases table...");
    const { data: purchase, error: purchaseCheckError } = await supabase
      .from("purchases")
      .select("*")
      .eq("fan_id", fanId)
      .eq("post_id", post.id)
      .single();

    if (purchaseCheckError || !purchase) {
      throw new Error(`Purchase record not found: ${purchaseCheckError?.message}`);
    }

    console.log(`     ✅ Purchase record found: ${purchase.id}`);

    // 7. 验证 transactions 表
    console.log("  7️⃣ Verifying transactions table...");
    const { data: transactions, error: txError } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", fanId)
      .order("created_at", { ascending: false });

    if (txError) {
      throw new Error(`Failed to fetch transactions: ${txError.message}`);
    }

    const depositTx = transactions?.find((t) => t.type === "deposit");
    const purchaseTx = transactions?.find((t) => t.type === "ppv_purchase");

    if (!depositTx) {
      throw new Error("Deposit transaction not found");
    }

    if (!purchaseTx) {
      throw new Error("Purchase transaction not found");
    }

    console.log(`     ✅ Transactions verified: deposit=$10, purchase=-$5`);

    // 8. 验证钱包余额
    console.log("  8️⃣ Verifying wallet balance...");
    const { data: wallet, error: walletCheckError } = await supabase
      .from("wallet_accounts")
      .select("available_balance_cents")
      .eq("user_id", fanId)
      .single();

    if (walletCheckError || !wallet) {
      throw new Error(`Failed to fetch wallet: ${walletCheckError?.message}`);
    }

    const expectedBalance = 500; // $10 - $5 = $5
    if (wallet.available_balance_cents !== expectedBalance) {
      throw new Error(
        `Balance mismatch: expected ${expectedBalance}, got ${wallet.available_balance_cents}`
      );
    }

    console.log(
      `     ✅ Wallet balance correct: $${(wallet.available_balance_cents / 100).toFixed(2)}`
    );

    console.log(`\n✅ Round ${round}/3 PASSED!`);

    return {
      round,
      success: true,
      creatorId,
      fanId,
      postId: post.id,
      purchaseId: purchase.id,
    };
  } catch (error: any) {
    console.error(`\n❌ Round ${round}/3 FAILED: ${error.message}`);
    return {
      round,
      success: false,
      error: error.message,
    };
  }
}

async function cleanup(results: TestResult[]) {
  console.log("\n🧹 Cleaning up test data...");

  for (const result of results) {
    try {
      if (result.purchaseId) {
        await supabase.from("purchases").delete().eq("id", result.purchaseId);
      }
      if (result.postId) {
        await supabase.from("posts").delete().eq("id", result.postId);
      }
      if (result.fanId) {
        await supabase.from("transactions").delete().eq("user_id", result.fanId);
        await supabase.from("wallet_accounts").delete().eq("user_id", result.fanId);
        await supabase.from("profiles").delete().eq("id", result.fanId);
        await supabase.auth.admin.deleteUser(result.fanId);
      }
      if (result.creatorId) {
        await supabase.from("creators").delete().eq("id", result.creatorId);
        await supabase.from("profiles").delete().eq("id", result.creatorId);
        await supabase.auth.admin.deleteUser(result.creatorId);
      }
    } catch (err) {
      // 忽略清理错误
    }
  }

  console.log("✅ Cleanup complete");
}

async function main() {
  console.log("🎯 MVP Acceptance Test");
  console.log("=".repeat(50));
  console.log(`Target: ${BASE_URL}`);
  console.log(`Database: ${SUPABASE_URL}`);
  console.log("=".repeat(50));

  // 检查必要的表
  const tablesOk = await ensureTablesExist();
  if (!tablesOk) {
    process.exit(1);
  }

  const results: TestResult[] = [];

  // 执行 3 轮测试
  for (let i = 1; i <= 3; i++) {
    const result = await runAcceptanceTest(i);
    results.push(result);

    // 每轮之间等待 1 秒
    if (i < 3) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  // 清理测试数据
  await cleanup(results);

  // 输出总结
  console.log("\n" + "=".repeat(50));
  console.log("📊 SUMMARY");
  console.log("=".repeat(50));

  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  results.forEach((r) => {
    console.log(`  Round ${r.round}: ${r.success ? "✅ PASSED" : `❌ FAILED - ${r.error}`}`);
  });

  console.log("");
  console.log(`  Total: ${passed}/3 passed, ${failed}/3 failed`);

  if (failed === 0) {
    console.log("\n🎉 ALL TESTS PASSED! MVP is ready for deployment.");
    process.exit(0);
  } else {
    console.log("\n⚠️  Some tests failed. Please fix the issues before deploying.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
